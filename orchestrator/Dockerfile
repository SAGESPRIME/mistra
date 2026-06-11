# Service Mastra (orchestrator) — workflows + serveur MCP intake en sous-processus stdio
# NOTE : non testé en local (pas de Docker sur la machine de dev) — à valider au déploiement

FROM node:22-alpine AS base

# ----- Dépendances de production uniquement (pour le runtime du serveur MCP) -----
FROM base AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY mcp-servers/intake/package.json ./mcp-servers/intake/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY orchestrator/package.json ./orchestrator/package.json
RUN npm ci --workspaces --if-present --omit=dev

# ----- Build (dépendances complètes : tsc + mastra CLI) -----
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY mcp-servers/intake/package.json ./mcp-servers/intake/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY orchestrator/package.json ./orchestrator/package.json
RUN npm ci --workspaces --if-present
COPY . .
RUN npm run build --workspace=@mistra/shared
RUN npm run build --workspace=@mistra/mcp-intake
RUN npm run build --workspace=@mistra/orchestrator

# ----- Image finale -----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# 1. Le bundle Mastra autonome (contient déjà ses propres node_modules)
COPY --from=builder /app/orchestrator/.mastra/output ./

# 2. Le serveur MCP intake (lancé en sous-processus stdio par l'orchestrator)
#    avec ses dépendances de production dans une arborescence séparée /repo
COPY --from=deps-prod /app/node_modules /repo/node_modules
COPY --from=builder /app/packages/shared/dist /repo/packages/shared/dist
COPY --from=builder /app/packages/shared/package.json /repo/packages/shared/package.json
COPY --from=builder /app/mcp-servers/intake/dist /repo/mcp-servers/intake/dist
COPY --from=builder /app/mcp-servers/intake/package.json /repo/mcp-servers/intake/package.json
ENV MCP_INTAKE_PATH=/repo/mcp-servers/intake/dist/index.js

EXPOSE 4111
# DEBUG : capture stderr + garder le conteneur vivant 60s après crash pour lire les logs
CMD ["sh", "-c", "echo '=== START orchestrator ===' && ls -la && node index.mjs 2>&1; echo \"EXIT CODE: $?\"; sleep 60"]
