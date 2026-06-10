FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY mcp-servers/intake/package.json ./mcp-servers/intake/package.json
RUN npm ci --workspaces --if-present

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY . .
RUN npm run build --workspace=@mistra/shared
RUN npm run build --workspace=@mistra/mcp-intake

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/mcp-servers/intake/dist ./mcp-servers/intake/dist
CMD ["node", "mcp-servers/intake/dist/index.js"]
