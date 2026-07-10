# ============================================================================
# AI Business OS — Backend (NestJS + Prisma)
# Contexto de build: raiz del monorepo (ver docker-compose.yml).
# ============================================================================

# ---- Etapa build ----
FROM node:22-alpine AS builder

# openssl es requerido por los motores de Prisma en Alpine.
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

WORKDIR /app

# Copiamos todo el monorepo (node_modules queda excluido por .dockerignore).
COPY . .

# Instalacion determinista desde el lockfile.
RUN pnpm install --frozen-lockfile

# Prisma client + compilacion del backend.
RUN pnpm --filter @ai-business-os/api prisma:generate
RUN pnpm --filter @ai-business-os/api build

# ---- Etapa runtime ----
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

ENV NODE_ENV=production
WORKDIR /app

# Traemos el workspace ya instalado y compilado.
COPY --from=builder /app ./

WORKDIR /app/apps/api

EXPOSE 3001

# Aplica migraciones pendientes y arranca el servidor.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
