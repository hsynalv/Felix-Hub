# Multi-stage build for production hardening
# PR-10: Deployment hardening

# Stage 1: Install API dependencies
FROM node:22-alpine AS api-deps

WORKDIR /build

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Build React UI
FROM node:22-alpine AS ui-builder

WORKDIR /build

COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

COPY frontend ./frontend
RUN npm run build --prefix frontend

# Stage 3: Production image
FROM node:22-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=api-deps /build/node_modules ./node_modules
COPY --from=api-deps /build/package*.json ./
COPY src ./src
COPY --from=ui-builder /build/src/public/app ./src/public/app

RUN chown -R nodejs:nodejs /app

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 8787

CMD ["node", "src/index.js"]
