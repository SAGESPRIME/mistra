FROM node:20-alpine AS base

# Dépendances
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspaces --if-present

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY . .
RUN npm run build --workspace=@mistra/shared
RUN npm run build --workspace=@mistra/web

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
