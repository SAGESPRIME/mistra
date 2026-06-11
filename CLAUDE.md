# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Chaîne de production comptable pour cabinets d'expertise comptable. Promesse : "livrer un dossier comptable pré-traité, prêt à finaliser, avec 80% du travail déjà préparé".

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) — `apps/web/` | Interface uniquement : afficher l'état, déclencher des actions, lire des résultats. Lectures SQL d'affichage dans `lib/queries.ts` (lecture seule) |
| Orchestration | Mastra — `orchestrator/src/mastra/` | Workflows déterministes (intake, recontrole), état des runs persisté dans Postgres (schéma `mastra`), API HTTP sur :4111 |
| Tools métier | Serveur MCP — `mcp-servers/intake/` | 9 tools atomiques (recevoir, OCR, classifier, extraire, rattacher, contrôler, consulter, rechercher, corriger), lancé en sous-processus **stdio** par l'orchestrator |
| Déploiement | Docker Compose + Coolify | 4 services : web, orchestrator, db, ocr (Gotenberg). Single-tenant par cabinet. Pas de MinIO : les fichiers uploadés sont stockés sur un volume et servis par Next (`/api/fichiers/[id]`) |
| Runtime | TypeScript partout | Pas de multi-langage |

**Principe clé :** la logique métier comptable vit dans les tools MCP et les workflows Mastra. Next.js ne contient AUCUNE logique métier — il appelle les workflows par HTTP (`apps/web/src/lib/mastra-client.ts` → `POST /api/workflows/{intake|recontrole}/start-async`).

**Source unique de vérité du statut :** le tool `intake_controler` est le SEUL endroit qui décide PRET/ANOMALIE (il inclut la détection de doublon). Le workflow exécute toujours ce contrôle en dernier, même si une étape amont a échoué.

## Agents (pipeline séquentiel)

1. **Intake documentaire** ✅ (V1 livrée — workflows `intake` + `recontrole`; l'agent conversationnel est reporté à V1.1)
2. **Lecture facture & pré-compta** — extraire les données structurées des pièces
3. **Génération d'écritures comptables** — produire les écritures PCG
4. **Rapprochement bancaire** — matcher écritures et relevés
5. **Dossier de révision prêt à finaliser** — contrôles de cohérence, anomalies
6. **Relance de pièces manquantes** — notifications et suivi
7. **Onboarding dossier client** — configuration initiale d'un nouveau client

Pour les agents 2 à 7 : ajouter les workflows dans `orchestrator/src/mastra/workflows/` et les tools dans un serveur MCP par domaine — PAS un service par agent.

## Règles de travail

- Toujours en mode PLAN d'abord, coder ensuite
- Tools MCP atomiques, bien nommés, avec schémas Zod clairs
- V1 simple, vendable, testable, maintenable
- Pas de sur-ingénierie, pas de théorie floue
- Penser "chaîne de production comptable", pas "chatbot comptable"
- Réponses structurées, concrètes, directement exploitables
- Expliquer en français simple (cf. instructions globales CLAUDE)
- Un changement sans vérification exécutée = travail non terminé

## Commandes

⚠️ Sur la machine de dev Windows : appeler npm par son chemin complet (`& "C:\Program Files\nodejs\npm.cmd"`) — un faux `npm` dans system32 masque le vrai. Pas de Docker en local : utiliser `db:local`.

```bash
npm run db:local       # Postgres 18 embarqué sur :5432 (schema.sql appliqué au 1er démarrage)
npm run dev:mastra     # Serveur Mastra sur :4111 (boot ~30-60s ; compiler shared + mcp-intake avant)
npm run dev            # Next.js sur :3000
npm run build --workspace=@mistra/shared       # À faire avant dev:mastra
npm run build --workspace=@mistra/mcp-intake   # idem (le MCP est lancé depuis dist/)

node scripts/mock-services.mjs   # Simulateur fichiers + Gotenberg + LLM sur :3997 (dev sans clé API)
node scripts/verif-e2e.mjs       # Vérification de bout en bout (4 scénarios métier)

docker compose up -d             # Production : web + orchestrator + db + ocr
```

Pour tester sans clé LLM : lancer `dev:mastra` avec `OCR_ENDPOINT=http://localhost:3997`, `LLM_BASE_URL=http://localhost:3997/v1`, `LLM_API_KEY=cle-de-test`.

## Structure

```
mistra/
├── apps/
│   └── web/                          # Next.js — interface UNIQUEMENT
│       └── src/
│           ├── app/                  # pages + routes API "passe-plat"
│           │   └── api/fichiers/     # sert les uploads au serveur MCP (GET + HEAD)
│           ├── components/ , hooks/
│           └── lib/
│               ├── mastra-client.ts  # seul point de contact avec Mastra
│               ├── fichiers.ts       # stockage disque des uploads
│               └── queries.ts        # lectures SQL d'affichage (lecture seule)
├── orchestrator/                     # Service Mastra — le cœur métier
│   └── src/mastra/
│       ├── index.ts                  # instance Mastra (workflows + storage Postgres schéma "mastra")
│       ├── workflows/                # intake.workflow.ts, recontrole.workflow.ts
│       ├── tools/                    # intake.tools.ts (résolution tools MCP + appelerToolIntake)
│       ├── mcp/                      # intake.mcp.ts (MCPClient stdio, MCP_INTAKE_PATH en Docker)
│       └── agents/                   # V1.1 — agent conversationnel intake
├── mcp-servers/
│   └── intake/                       # Serveur MCP intake (9 tools + services OCR/LLM + repository)
├── packages/
│   └── shared/                       # Types, schémas Zod, constantes (limites, contrôles)
├── scripts/                          # schema.sql, db-local, mock-services, verif-*
├── docker-compose.yml
└── CLAUDE.md
```

## Conventions

- Types partagés dans `packages/shared/` (schémas Zod réutilisés par MCP + Mastra + Frontend)
- Un MCP server = un domaine métier cohérent ; transport stdio (sous-processus de l'orchestrator)
- Les statuts pièces/écritures sont des enums stricts, pas des strings libres
- Les montants sont toujours en centimes (integer), les taux en points de base (2000 = 20%)
- Parseurs de types pg obligatoires (DATE→string, BIGINT/NUMERIC→number) — déjà en place dans `mcp-servers/intake/src/db/connection.ts` et `apps/web/src/lib/queries.ts` ; sans eux, `"10000" + "2000"` concatène au lieu d'additionner
- Serveur MCP en stdio : ne JAMAIS écrire sur stdout (`console.log` interdit, `console.error` ok) — stdout est le canal JSON-RPC
- Les tools MCP retournent un `McpOutput` `{success, data, error}` sérialisé dans le format MCP `{content:[{type:"text",text}]}` ; côté workflow, passer par `appelerToolIntake`
