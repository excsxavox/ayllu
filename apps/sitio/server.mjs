import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const rootPrefix = root.toLowerCase() + sep;
const port = Number(process.env.SITIO_PORT || 3002);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

const whatsappPhone = String(process.env.SITIO_WHATSAPP_PHONE || "15556310030").replace(/\D/g, "");
const siteApi = String(process.env.SITIO_API_URL || "https://api.innovamf.com").replace(/\/$/, "");
const siteCompany = String(process.env.SITIO_COMPANY_SLUG || "alpha-demo").trim() || "alpha-demo";

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  if (path === "/site-config.js") {
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      `window.AylluSite=${JSON.stringify({
        whatsapp: whatsappPhone,
        api: siteApi,
        company: siteCompany,
      })};`,
    );
    return;
  }
  const file = resolve(root, path.replace(/^\/+/, ""));
  if (file.toLowerCase() !== root.toLowerCase() && !file.toLowerCase().startsWith(rootPrefix)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    const ext = extname(file);
    res.writeHead(200, {
      "Content-Type": types[ext] ?? "application/octet-stream",
      "Cache-Control": ext === ".html" || ext === ".js" ? "no-store" : "public, max-age=300",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
});

server.listen(port, () => {
  console.log(`Sitio AYLLU en http://localhost:${port}`);
});
