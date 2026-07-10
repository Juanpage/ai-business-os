# ============================================================================
# AI Business OS — Frontend (Next.js 14)
# Contexto de build: raiz del monorepo (ver docker-compose.yml).
# ============================================================================

# ---- Etapa build ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

WORKDIR /app

# Copiamos todo el monorepo (node_modules queda excluido por .dockerignore).
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-business-os/web build

# ---- Etapa runtime ----
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app ./

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "start"]
