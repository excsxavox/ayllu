import { Injectable, Logger } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { URL } from "url";
import { ConfigService } from "@nestjs/config";
import { CryptoService } from "../common/crypto.service";
import { PrismaService } from "../prisma/prisma.service";

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async resolveConfig(companyId: string): Promise<LlmConfig | null> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const companyKey = this.crypto.decryptOrNull(company?.llmApiKeyEnc);
    const apiKey = companyKey || this.config.get<string>("OPENAI_API_KEY") || "";
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: company?.llmBaseUrl || this.config.get("OPENAI_BASE_URL") || "https://api.openai.com/v1",
      chatModel: company?.chatModel || this.config.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini",
      embeddingModel:
        company?.embeddingModel || this.config.get("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small",
    };
  }

  async embed(companyId: string, texts: string[]): Promise<number[][] | null> {
    const cfg = await this.resolveConfig(companyId);
    if (!cfg || !texts.length) return null;
    try {
      const data = await this.postJson<{ data: Array<{ embedding: number[] }> }>(
        `${cfg.baseUrl.replace(/\/$/, "")}/embeddings`,
        cfg.apiKey,
        { model: cfg.embeddingModel, input: texts },
      );
      return data.data.map((d) => d.embedding);
    } catch (err) {
      this.logger.warn(`Embedding error: ${(err as Error).message}`);
      return null;
    }
  }

  async chat(companyId: string, system: string, user: string): Promise<string | null> {
    const cfg = await this.resolveConfig(companyId);
    if (!cfg) return null;
    try {
      const data = await this.postJson<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, cfg.apiKey, {
        model: cfg.chatModel,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (err) {
      this.logger.warn(`Chat error: ${(err as Error).message}`);
      return null;
    }
  }

  async inspectImage(
    companyId: string,
    system: string,
    prompt: string,
    image: Buffer,
    mimeType: string,
  ): Promise<string | null> {
    const cfg = await this.resolveConfig(companyId);
    if (!cfg) return null;
    const mime = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    try {
      const data = await this.postJson<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, cfg.apiKey, {
        model: cfg.chatModel,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${image.toString("base64")}` },
              },
            ],
          },
        ],
      });
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (err) {
      this.logger.warn(`Vision error: ${(err as Error).message}`);
      return null;
    }
  }

  private postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: `${parsed.pathname}${parsed.search}`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          rejectUnauthorized: process.platform !== "win32",
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`${res.statusCode} ${text.slice(0, 240)}`));
              return;
            }
            try {
              resolve(JSON.parse(text) as T);
            } catch (err) {
              reject(err);
            }
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }
}
