# syntax=docker/dockerfile:1.7

FROM node:20-slim AS builder

WORKDIR /workspace/frontend

ARG NEXT_PUBLIC_API_BASE_URL
ARG API_INTERNAL_URL
ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY frontend/package*.json ./
RUN npm config set registry $NPM_REGISTRY
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

COPY frontend ./
COPY shared ../shared
RUN --mount=type=cache,target=/workspace/frontend/.next/cache \
    npm run build

FROM node:20-slim AS runner

WORKDIR /app

ARG API_INTERNAL_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=$API_INTERNAL_URL

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /workspace/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
