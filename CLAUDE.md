# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Chaîne de production comptable pour cabinets d'expertise comptable. Promesse : "livrer un dossier comptable pré-traité, prêt à finaliser, avec 80% du travail déjà préparé".

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) | Interface cabinet comptable |
| Orchestration agents | Mastra | Workflows, étapes, retry, state machine |
| Tools métier | MCP servers (TypeScript) | Fonctions atomiques : OCR, classification, validation, écritures |
| Déploiement | Docker Compose + Coolify | Single-tenant par client cabinet |
| Runtime | TypeScript partout | Pas de multi-langage |

**Principe clé :** La logique métier comptable vit dans les MCP tools et les workflows Mastra. L'agent conversationnel orchestre, il n'invente pas de logique métier.

## Agents (pipeline séquentiel)

1. **Intake documentaire** — recevoir, classifier, contrôler, rattacher les pièces
2. **Lecture facture & pré-compta** — extraire les données structurées des pièces
3. **Génération d'écritures comptables** — produire les écritures PCG
4. **Rapprochement bancaire** — matcher écritures et relevés
5. **Dossier de révision prêt à finaliser** — contrôles de cohérence, anomalies
6. **Relance de pièces manquantes** — notifications et suivi
7. **Onboarding dossier client** — configuration initiale d'un nouveau client

Chaque agent suit le même cycle : cadrage métier → design MCP → workflow Mastra → frontend minimal → déploiement → QA.

## Règles de travail

- Toujours en mode PLAN d'abord, coder ensuite
- Tools MCP atomiques, bien nommés, avec schémas Zod clairs
- V1 simple, vendable, testable, maintenable
- Pas de sur-ingénierie, pas de théorie floue
- Penser "chaîne de production comptable", pas "chatbot comptable"
- Réponses structurées, concrètes, directement exploitables
- Expliquer en français simple (cf. instructions globales CLAUDE)

## Commandes (à créer)

```bash
docker compose up -d          # Démarrer l'environnement local
docker compose logs -f agent1 # Suivre les logs d'un agent
npm run dev                   # Dev Next.js
npm run build                 # Build production
npm test                      # Tests
npm run test -- --grep "OCR"  # Un seul test
```

## Structure attendue

```
mistra/
├── apps/
│   └── web/                    # Next.js frontend
├── agents/
│   ├── agent-1-intake/         # Chaque agent = son propre module
│   ├── agent-2-lecture/
│   └── ...
├── mcp-servers/
│   ├── ocr/                    # MCP server : OCR
│   ├── classification/         # MCP server : classification documents
│   ├── validation/             # MCP server : contrôles documentaires
│   └── ...
├── packages/
│   └── shared/                 # Types, schémas, utilitaires partagés
├── docker-compose.yml
├── coolify.json
└── CLAUDE.md
```

## Conventions

- Types partagés dans `packages/shared/` (schémas Zod réutilisés par MCP + Mastra + Frontend)
- Un MCP server = un domaine métier cohérent
- Les statuts pièces/écritures sont des enums stricts, pas des strings libres
- Les montants sont toujours en centimes (integer) pour éviter les erreurs float
