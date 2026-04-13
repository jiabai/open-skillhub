FROM node:20-slim AS builder

WORKDIR /workspace/frontend

ARG NEXT_PUBLIC_API_BASE_URL
ARG API_INTERNAL_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
COPY shared ../shared
RUN npm run build

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
