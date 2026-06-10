FROM node:20-alpine AS base

# Dépendances — installer tout le monorepo
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
ENV NODE_ENV=development
RUN npm ci --workspaces

# Build — copier TOUT depuis deps (node_modules des workspaces inclus)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY . .
ENV PATH="/app/node_modules/.bin:$PATH"
RUN npm run build --workspace=@mistra/shared
RUN npm run build --workspace=@mistra/web

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
