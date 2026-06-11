import { intakeMcp } from "../mcp/intake.mcp.js";

// Tools du serveur MCP intake, résolus une fois au démarrage.
// Configuration statique : single-tenant, un seul serveur, identifiants fixes.
// Les noms sont préfixés par le nom du serveur : "intake_intake_recevoir_fichier" etc.
// (préfixe "intake_" du MCPClient + nom du tool qui commence déjà par "intake_")
export const intakeTools = await intakeMcp.listTools();

// Résultat métier standard des tools intake (McpOutput, défini dans packages/shared)
export type ResultatTool = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
};

// Appelle un tool MCP intake et retourne son résultat métier.
// Utilisé par TOUS les workflows (intake, recontrole) — un seul endroit à corriger.
// - retrouve le tool par suffixe (à cause du préfixe serveur)
// - désérialise le McpOutput depuis le format MCP { content: [{ type, text }] }
// - convertit un crash de tool (réponse texte brut non-JSON) en échec métier propre
export async function appelerToolIntake(
  suffixe: string,
  args: Record<string, unknown>,
): Promise<ResultatTool> {
  const cle = Object.keys(intakeTools).find((n) => n.endsWith(suffixe));
  if (!cle) throw new Error(`Tool MCP introuvable: *${suffixe}`);

  // Appel direct hors agent : le contexte d'exécution complet n'existe pas ici,
  // le client MCP n'en a pas besoin (vérifié par scripts/verif-etape2.mjs)
  const executer = intakeTools[cle].execute as unknown as (
    a: Record<string, unknown>,
    c: Record<string, never>,
  ) => Promise<unknown>;
  const reponse = (await executer(args, {})) as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  const texte = reponse?.content?.[0]?.text;
  if (!texte) throw new Error(`Réponse MCP vide pour ${suffixe}`);

  try {
    return JSON.parse(texte) as ResultatTool;
  } catch {
    return {
      success: false,
      error: { code: "TOOL_CRASH", message: `${suffixe}: ${texte.substring(0, 300)}` },
    };
  }
}
