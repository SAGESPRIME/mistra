import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { intakeWorkflow } from "./workflows/intake.workflow.js";
import { recontroleWorkflow } from "./workflows/recontrole.workflow.js";

// Instance Mastra centrale : tous les agents, workflows et tools y sont enregistrés.
// L'état des runs (suspension, reprise, retry) vit dans le schéma "mastra" de la
// base Postgres existante — séparé des tables métier (pieces, dossiers, etc.)
export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mistra-storage",
    connectionString: process.env.DATABASE_URL ?? "",
    schemaName: "mastra",
  }),

  workflows: { intakeWorkflow, recontroleWorkflow },

  // V1.1 : agents: { intakeAgent }
});
