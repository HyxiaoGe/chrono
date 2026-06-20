FROM node:22-alpine AS deps
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ARG API_BASE_URL=http://localhost:8000/api
ENV API_BASE_URL=$API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    corepack enable && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs &&     adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
