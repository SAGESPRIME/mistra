// Client HTTP vers le serveur Mastra — SEUL point de contact entre Next.js
// et l'orchestration. Le frontend ne contient aucune logique métier :
// il déclenche le workflow et lit le résultat.

const MASTRA_URL = process.env.MASTRA_URL ?? "http://localhost:4111";

export interface ResultatIntake {
  piece_id: string;
  statut: "PRET" | "ANOMALIE";
  controle_code: string | null;
  erreurs_count: number;
  warnings_count: number;
}

export interface InputIntake {
  cabinet_id: string;
  client_id: string;
  fichier_url: string;
  fichier_nom: string;
  fichier_type: string;
  source: "upload";
}

export interface ControleLigne {
  code: string;
  resultat: "ok" | "warning" | "erreur";
  message: string;
}

export interface ResultatRecontrole {
  piece_id: string;
  statut: "PRET" | "ANOMALIE";
  controle_code: string | null;
  erreurs_count: number;
  warnings_count: number;
  champs_corriges: string[];
  controles: ControleLigne[];
}

// Lance un workflow Mastra et attend son résultat.
// Le run est persisté par Mastra (mastra_workflow_snapshot) : en cas de crash
// serveur, l'état n'est pas perdu, contrairement à l'ancien fire-and-forget.
async function lancerWorkflow<T>(workflowId: string, inputData: unknown): Promise<T> {
  const reponse = await fetch(`${MASTRA_URL}/api/workflows/${workflowId}/start-async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputData }),
  });

  const corps = (await reponse.json().catch(() => null)) as {
    status?: string;
    result?: T;
    error?: { message?: string };
  } | null;

  if (!reponse.ok || !corps) {
    throw new Error(`Serveur Mastra injoignable ou en erreur (HTTP ${reponse.status})`);
  }
  if (corps.status !== "success" || !corps.result) {
    throw new Error(corps.error?.message ?? `Workflow ${workflowId} échoué`);
  }
  return corps.result;
}

export async function lancerWorkflowIntake(input: InputIntake): Promise<ResultatIntake> {
  return lancerWorkflow<ResultatIntake>("intake", input);
}

export async function lancerWorkflowRecontrole(input: {
  cabinet_id: string;
  piece_id: string;
  corrections: Record<string, unknown>;
}): Promise<ResultatRecontrole> {
  return lancerWorkflow<ResultatRecontrole>("recontrole", input);
}
