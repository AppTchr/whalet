# =============================================================================
# Whalet Web — Multi-stage Dockerfile
#
# EasyPanel config:
#   - Dockerfile path: apps/web/Dockerfile
#   - Build context:   . (repo root)
#   - Port:            3000
# =============================================================================

FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

FROM deps AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN pnpm build

FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||3000;const req=http.get({host:'127.0.0.1',port,path:'/health',timeout:5000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

CMD ["node", "apps/web/server.js"]
