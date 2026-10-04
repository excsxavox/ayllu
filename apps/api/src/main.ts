import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, raw, urlencoded, type NextFunction, type Request, type Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });
  const origins = [
    ...new Set([
      "http://localhost:3000",
      "http://localhost:3005",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3005",
      ...(process.env.WEB_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    ]),
  ];
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      if (origins.includes(requestOrigin)) {
        callback(null, requestOrigin);
        return;
      }
      try {
        const url = new URL(requestOrigin);
        const port = url.port || (url.protocol === "https:" ? "443" : "80");
        const lan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname);
        callback(null, lan && (port === "3000" || port === "3005") ? requestOrigin : false);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Company-Id"],
  });

  app.use(
    "/webhooks/whatsapp",
    raw({ type: "application/json" }),
    (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
      req.rawBody = req.body as Buffer;
      if (Buffer.isBuffer(req.body)) {
        try {
          req.body = JSON.parse(req.body.toString("utf8"));
        } catch {
          req.body = {};
        }
      }
      next();
    },
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith("/webhooks/whatsapp")) return next();
    json({ limit: "2mb" })(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith("/webhooks/whatsapp")) return next();
    urlencoded({ extended: true })(req, res, next);
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`AYLLUU API lista en http://localhost:${port}`);
}

bootstrap();
