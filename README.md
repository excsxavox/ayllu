# AYLLUU

Plataforma multiempresa: panel de gestión + bot de WhatsApp. El catálogo, las reglas y el conocimiento viven en PostgreSQL; la recuperación semántica usa **pgvector**. El canal de WhatsApp es un adaptador (Meta Cloud API ahora; Evolution/Twilio después).

## Requisitos

- Node 20+
- pnpm
- Docker (Postgres + Redis)

## Arranque local

Arranca **Docker Desktop** antes (Postgres + Redis). Luego:

```bash
docker compose up -d
pnpm install
pnpm --filter @aylluu/shared build
pnpm --filter @aylluu/api prisma:generate
pnpm --filter @aylluu/api exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

- Panel: http://localhost:3000
- App móvil de piso: http://localhost:3005 (`pnpm dev:movil`)
- API: http://localhost:3001
- Postgres de Docker usa el puerto **5433** (el 5432 suele estar ocupado por un Postgres local)
- Usuarios demo (contraseña `Admin1234`):
  - `admin@aylluu.local` — admin de plataforma (Alpha y Beta)
  - `alpha@aylluu.local` — solo Alpha
  - `beta@aylluu.local` — solo Beta

En el resumen puedes simular un mensaje inbound sin Meta. Para WhatsApp real, configura tokens en **Ajustes** y apunta el webhook a `/webhooks/whatsapp`. Checklist Meta: [docs/META_CHECKLIST.md](docs/META_CHECKLIST.md). Onboarding de un cliente nuevo: [docs/MANUAL_NUEVO_CLIENTE_WHATSAPP.md](docs/MANUAL_NUEVO_CLIENTE_WHATSAPP.md). Puertos del servidor: [docs/PUERTOS_SERVIDOR.mmd](docs/PUERTOS_SERVIDOR.mmd).

## Estructura

```
apps/api          NestJS, Prisma, colas, bot
apps/web          Panel Next.js
packages/shared   Esquemas Zod
```

Copia `.env.example` si cambias secretos. `ENCRYPTION_KEY` debe ser 32 bytes en hex.
