import { Injectable, Logger } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";
import { promisify } from "util";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import { URL } from "url";
import { NormalizedInboundMessage } from "@aylluu/shared";
import { WebhookQuery, WhatsAppChannel } from "./provider.interface";

const execFileAsync = promisify(execFile);


type MetaChange = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string };
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
    messages?: Array<{
      id: string;
      from: string;
      timestamp: string;
      type: string;
      text?: { body?: string };
      button?: { text?: string };
      image?: { id?: string; mime_type?: string; caption?: string };
      document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
      interactive?: {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
    }>;
  };
};

@Injectable()
export class MetaCloudApiProvider implements WhatsAppChannel {
  readonly provider = "META" as const;
  private readonly logger = new Logger(MetaCloudApiProvider.name);

  verifyWebhook(query: WebhookQuery, expectedToken: string): string | null {
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === expectedToken) {
      return query["hub.challenge"] ?? "";
    }
    return null;
  }

  verifySignature(rawBody: Buffer, signature: string | undefined, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  parseInbound(payload: unknown): NormalizedInboundMessage[] {
    const body = payload as {
      entry?: Array<{ changes?: MetaChange[] }>;
    };
    const out: NormalizedInboundMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;
        const phoneNumberId = value.metadata?.phone_number_id ?? "";
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const msg of value.messages) {
          const media = msg.image ?? msg.document;
          const text =
            msg.text?.body ??
            msg.image?.caption ??
            msg.document?.caption ??
            msg.button?.text ??
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            "";
          out.push({
            provider: "META",
            phoneNumberId,
            from: msg.from,
            contactName,
            providerMessageId: msg.id,
            type: msg.type,
            text,
            timestamp: msg.timestamp,
            mediaId: media?.id,
            mimeType: media?.mime_type,
            raw: msg,
          });
        }
      }
    }
    return out;
  }

  async sendText(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    text: string;
  }): Promise<{ providerMessageId?: string }> {
    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.text },
    });
    const data = await this.postGraph(
      `/v21.0/${params.phoneNumberId}/messages`,
      params.accessToken,
      payload,
    );
    return { providerMessageId: data.messages?.[0]?.id };
  }

  async sendImage(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    imageUrl?: string;
    filePath?: string;
    caption?: string;
  }): Promise<{ providerMessageId?: string }> {
    const image: { link?: string; id?: string; caption?: string } = {};
    if (params.caption) image.caption = params.caption.slice(0, 1024);

    if (params.filePath) {
      image.id = await this.uploadLocalImage(params.accessToken, params.phoneNumberId, params.filePath);
    } else if (params.imageUrl && /^https?:\/\//i.test(params.imageUrl) && !isPrivateHost(params.imageUrl)) {
      const remote = await this.fetchPublic(params.imageUrl);
      const head = remote.buffer.subarray(0, 12);
      const isJpeg = head[0] === 0xff && head[1] === 0xd8;
      const isPng = head[0] === 0x89 && head[1] === 0x50;
      const isImage = isJpeg || isPng || head.subarray(0, 4).toString() === "RIFF" || head.subarray(0, 3).toString() === "GIF";
      if (!isImage) throw new Error("La URL no devolvió una imagen");
      const file = isJpeg || isPng ? remote.buffer : await this.toJpeg(remote.buffer);
      const mimeType = isPng && file === remote.buffer ? "image/png" : "image/jpeg";
      this.logger.log(`Foto para WhatsApp: ${mimeType}, ${file.length} bytes`);
      image.id = await this.uploadBuffer(
        params.accessToken,
        params.phoneNumberId,
        file,
        mimeType,
        mimeType === "image/png" ? "photo.png" : "photo.jpg",
      );
    } else {
      throw new Error("Falta una foto pública o un archivo local");
    }

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "image",
      image,
    });
    const data = await this.postGraph(
      `/v21.0/${params.phoneNumberId}/messages`,
      params.accessToken,
      payload,
    );
    return { providerMessageId: data.messages?.[0]?.id };
  }

  async downloadMedia(params: {
    accessToken: string;
    mediaId: string;
  }): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const meta = await this.graphJson<{ url?: string; mime_type?: string }>(
      `/v21.0/${params.mediaId}`,
      params.accessToken,
    );
    if (!meta.url) return null;
    return this.fetchBinary(meta.url, params.accessToken, meta.mime_type ?? "image/jpeg");
  }

  private graphJson<T>(path: string, accessToken: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: "graph.facebook.com",
          path,
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          rejectUnauthorized: process.platform !== "win32",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`Meta media meta failed: ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(body) as T);
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  private fetchBinary(url: string, accessToken: string, mimeType: string) {
    return new Promise<{ buffer: Buffer; mimeType: string } | null>((resolve, reject) => {
      const parsed = new URL(url);
      const req = httpsRequest(
        {
          hostname: parsed.hostname,
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          rejectUnauthorized: process.platform !== "win32",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`Meta media download failed: ${res.statusCode}`));
              return;
            }
            resolve({
              buffer: Buffer.concat(chunks),
              mimeType: res.headers["content-type"] || mimeType,
            });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  private postGraph(path: string, accessToken: string, payload: string) {
    return new Promise<{ messages?: Array<{ id?: string }> }>((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: "graph.facebook.com",
          path,
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          rejectUnauthorized: process.platform !== "win32",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 400) {
              this.logger.error(`Meta send failed: ${res.statusCode} ${body}`);
              reject(new Error(`WhatsApp send failed: ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(body) as { messages?: Array<{ id?: string }> });
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  private fetchPublic(url: string, redirects = 0): Promise<{ buffer: Buffer; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const request = parsed.protocol === "http:" ? httpRequest : httpsRequest;
      const req = request(
        {
          hostname: parsed.hostname,
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
        },
        (res) => {
          const location = res.headers.location;
          if (location && [301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && redirects < 5) {
            res.resume();
            resolve(this.fetchPublic(new URL(location, url).toString(), redirects + 1));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`No se pudo descargar la foto: ${res.statusCode}`));
              return;
            }
            const raw = String(res.headers["content-type"] || "image/jpeg").split(";")[0].trim();
            resolve({ buffer: Buffer.concat(chunks), mimeType: raw.startsWith("image/") ? raw : "image/jpeg" });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  private async toJpeg(buffer: Buffer): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), "aylluu-photo-"));
    const source = join(dir, "in.bin");
    const target = join(dir, "out.jpg");
    try {
      await writeFile(source, buffer);
      await execFileAsync("convert", [source, "jpg:" + target]);
      return await readFile(target);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async uploadLocalImage(accessToken: string, phoneNumberId: string, filePath: string): Promise<string> {
    const file = await readFile(filePath);
    const mimeType = mimeFromPath(filePath);
    if (mimeType === "image/webp" || mimeType === "image/gif") {
      const jpeg = await this.toJpeg(file);
      return this.uploadBuffer(accessToken, phoneNumberId, jpeg, "image/jpeg", "photo.jpg");
    }
    const filename = filePath.split(/[/\\]/).pop() || "photo.jpg";
    return this.uploadBuffer(accessToken, phoneNumberId, file, mimeType, filename);
  }

  private async uploadBuffer(
    accessToken: string,
    phoneNumberId: string,
    file: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<string> {
    const boundary = `----aylluu${randomBytes(8).toString("hex")}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${mimeType}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, file, tail]);
    const data = await this.postMultipart<{ id?: string }>(
      `/v21.0/${phoneNumberId}/media`,
      accessToken,
      boundary,
      body,
    );
    if (!data.id) throw new Error("Meta no devolvió id de media");
    return data.id;
  }

  private postMultipart<T>(path: string, accessToken: string, boundary: string, body: Buffer): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: "graph.facebook.com",
          path,
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length,
          },
          rejectUnauthorized: process.platform !== "win32",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 400) {
              this.logger.error(`Meta media upload failed: ${res.statusCode} ${text}`);
              reject(new Error(`WhatsApp media upload failed: ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(text) as T);
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

function isPrivateHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return true;
  }
}

function mimeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}
