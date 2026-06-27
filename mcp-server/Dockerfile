# Felix Hub — production image (API + built SPA)
# Build: docker compose build
# Run:   docker compose up -d

# ── API dependencies (pnpm) ───────────────────────────────────────────────────
FROM node:22-bookworm-slim AS api-deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm store prune

# ── React UI ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS ui-builder

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend --ignore-scripts

COPY frontend ./frontend
RUN npm run build --prefix frontend

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production

RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

COPY --from=api-deps /build/node_modules ./node_modules
COPY --from=api-deps /build/package.json ./
COPY src ./src
COPY --from=ui-builder /build/src/public/app ./src/public/app

RUN mkdir -p cache logs && chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=8787
ENV HUB_BIND_HOST=0.0.0.0

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
