FROM node:20-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV EDITORPULSE_UPLOADS_DIR=/data/editorpulse/uploads

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads /data/editorpulse/uploads \
  && chown -R nextjs:nodejs /app
RUN chown -R nextjs:nodejs /data

VOLUME ["/data/editorpulse/uploads"]

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
