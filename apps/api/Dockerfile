# =============================================================================
# Whalet API — Multi-stage Dockerfile
#
# Build context: monorepo root (.)
# EasyPanel config:
#   - Dockerfile path: apps/api/Dockerfile
#   - Build context:   . (repo root)
#   - Port:            3000
# =============================================================================

# =============================================================================
# Stage 1 — Install all dependencies (needed for build)
# =============================================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first — maximises layer cache reuse
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install all deps (including devDeps needed for prisma generate + nest build)
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2 — Build
# =============================================================================
FROM deps AS builder

WORKDIR /app

# Copy source code and configs
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Generate Prisma client then compile TypeScript
WORKDIR /app/apps/api
RUN pnpm prisma:generate
RUN pnpm build

# =============================================================================
# Stage 3 — Production runner (lean image)
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema + migrations (needed by prisma migrate deploy at startup)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Generate Prisma client inside the production image so we don't depend on
# pnpm's internal store layout between stages.
WORKDIR /app/apps/api
RUN pnpm prisma:generate

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||3000;const req=http.get({host:'127.0.0.1',port,path:'/health',timeout:5000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

# Run pending migrations then start the API
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
