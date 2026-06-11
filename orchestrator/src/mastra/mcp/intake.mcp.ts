import { MCPClient } from "@mastra/mcp";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Client MCP vers le serveur intake (transport stdio — décision G.1).
// Le serveur est lancé en sous-processus node ; on lui transmet toute la
// configuration dont ses services ont besoin (DB, OCR, LLM).

// Localisation du serveur compilé :
// 1. MCP_INTAKE_PATH si défini (Docker, déploiement)
// 2. sinon, recherche en remontant depuis le dossier courant — robuste quel que
//    soit le cwd réel (orchestrator/, racine du repo, bundle .mastra/output...)
function trouverServeurIntake(): string {
  if (process.env.MCP_INTAKE_PATH) return process.env.MCP_INTAKE_PATH;

  let dossier = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidat = join(dossier, "mcp-servers", "intake", "dist", "index.js");
    if (existsSync(candidat)) return candidat;
    const parent = dirname(dossier);
    if (parent === dossier) break; // racine du disque atteinte
    dossier = parent;
  }
  throw new Error(
    "Serveur MCP intake introuvable (mcp-servers/intake/dist/index.js) — " +
      "le compiler avec `npm run build --workspace=@mistra/mcp-intake` ou définir MCP_INTAKE_PATH",
  );
}

export const intakeMcp = new MCPClient({
  id: "mistra-intake",
  servers: {
    intake: {
      command: "node",
      args: [trouverServeurIntake()],
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        OCR_ENDPOINT: process.env.OCR_ENDPOINT ?? "",
        LLM_BASE_URL: process.env.LLM_BASE_URL ?? "",
        LLM_API_KEY: process.env.LLM_API_KEY ?? "",
        LLM_MODEL: process.env.LLM_MODEL ?? "",
      },
    },
  },
});
