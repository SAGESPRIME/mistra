import { Workflow, Step } from "@mastra/core";
import { z } from "zod";

// Types d'entrée du workflow
const workflowInput = z.object({
  cabinet_id: z.string().uuid(),
  client_id: z.string().uuid(),
  fichier_url: z.string().url(),
  fichier_nom: z.string(),
  fichier_type: z.enum(["pdf", "jpeg", "png", "webp"]),
  source: z.literal("upload"),
});

// ===== STEPS =====

// Step 1 : Recevoir fichier
const recevoirFichier = new Step({
  id: "recevoir-fichier",
  inputSchema: workflowInput,
  outputSchema: z.object({
    piece_id: z.string(),
    statut: z.string(),
  }),
  execute: async ({ input, mastra }) => {
    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_recevoir_fichier", {
      cabinet_id: input.cabinet_id,
      client_id: input.client_id,
      fichier_url: input.fichier_url,
      fichier_nom: input.fichier_nom,
      fichier_type: input.fichier_type,
      source: input.source,
    });
    if (!result.success) throw new Error(result.error?.message ?? "Erreur réception fichier");
    return result.data;
  },
});

// Step 2 : Analyser OCR
const analyserOcr = new Step({
  id: "analyser-ocr",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    ocr_confidence: z.number(),
    bloque: z.boolean().optional(),
  }),
  execute: async ({ input, mastra }) => {
    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_analyser_ocr", input);

    if (!result.success) {
      // OCR échoué → on continue mais flag comme bloqué
      return { piece_id: input.piece_id, ocr_confidence: 0, bloque: true };
    }

    return {
      piece_id: input.piece_id,
      ocr_confidence: result.data.ocr_confidence,
      bloque: false,
    };
  },
});

// Step 3 : Classifier
const classifier = new Step({
  id: "classifier",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
    bloque: z.boolean().optional(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    type_document: z.string().nullable(),
    bloque: z.boolean().optional(),
  }),
  execute: async ({ input, mastra }) => {
    if (input.bloque) return { piece_id: input.piece_id, type_document: null, bloque: true };

    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_classifier", {
      cabinet_id: input.cabinet_id,
      piece_id: input.piece_id,
    });

    if (!result.success) {
      return { piece_id: input.piece_id, type_document: null, bloque: true };
    }

    return {
      piece_id: input.piece_id,
      type_document: result.data.type_document,
      bloque: false,
    };
  },
});

// Step 4 : Extraire données
const extraireDonnees = new Step({
  id: "extraire-donnees",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
    bloque: z.boolean().optional(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    bloque: z.boolean().optional(),
  }),
  execute: async ({ input, mastra }) => {
    if (input.bloque) return { piece_id: input.piece_id, bloque: true };

    const mcpClient = mastra.getMcpClient("mistra-intake");
    await mcpClient.callTool("intake_extraire_donnees", {
      cabinet_id: input.cabinet_id,
      piece_id: input.piece_id,
    });

    return { piece_id: input.piece_id, bloque: false };
  },
});

// Step 5 : Rattacher
const rattacher = new Step({
  id: "rattacher",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
    bloque: z.boolean().optional(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    dossier_id: z.string().nullable(),
    bloque: z.boolean().optional(),
  }),
  execute: async ({ input, mastra }) => {
    if (input.bloque) return { piece_id: input.piece_id, dossier_id: null, bloque: true };

    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_rattacher", {
      cabinet_id: input.cabinet_id,
      piece_id: input.piece_id,
    });

    return {
      piece_id: input.piece_id,
      dossier_id: result.success ? result.data.dossier_id : null,
      bloque: !result.success,
    };
  },
});

// Step 6 : Détecter doublon
const detecterDoublon = new Step({
  id: "detecter-doublon",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
    bloque: z.boolean().optional(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    doublon_flag: z.boolean(),
    bloque: z.boolean().optional(),
  }),
  execute: async ({ input, mastra }) => {
    if (input.bloque) return { piece_id: input.piece_id, doublon_flag: false, bloque: true };

    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_detecter_doublon", {
      cabinet_id: input.cabinet_id,
      piece_id: input.piece_id,
    });

    return {
      piece_id: input.piece_id,
      doublon_flag: result.success ? result.data.doublon_detecte : false,
      bloque: false,
    };
  },
});

// Step 7 : Contrôler (final)
const controler = new Step({
  id: "controler",
  inputSchema: z.object({
    cabinet_id: z.string(),
    piece_id: z.string(),
    doublon_flag: z.boolean(),
    bloque: z.boolean().optional(),
  }),
  outputSchema: z.object({
    piece_id: z.string(),
    statut: z.string(),
    erreurs_count: z.number(),
    warnings_count: z.number(),
  }),
  execute: async ({ input, mastra }) => {
    if (input.bloque) return { piece_id: input.piece_id, statut: "ANOMALIE", erreurs_count: 1, warnings_count: 0 };

    const mcpClient = mastra.getMcpClient("mistra-intake");
    const result = await mcpClient.callTool("intake_controler", {
      cabinet_id: input.cabinet_id,
      piece_id: input.piece_id,
    });

    if (!result.success) {
      return { piece_id: input.piece_id, statut: "ANOMALIE", erreurs_count: 1, warnings_count: 0 };
    }

    return {
      piece_id: input.piece_id,
      statut: result.data.statut,
      erreurs_count: result.data.erreurs_count,
      warnings_count: result.data.warnings_count,
    };
  },
});

// ===== WORKFLOW =====

export const intakeWorkflow = new Workflow({
  name: "intake-documentaire",
  triggerSchema: workflowInput,
})
  .step(recevoirFichier)
  .then(analyserOcr, {
    // Passe le piece_id du step précédent
    map: ({ recevoirFichier: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
    }),
  })
  .then(classifier, {
    map: ({ analyserOcr: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
      bloque: prev.bloque,
    }),
  })
  .then(extraireDonnees, {
    map: ({ classifier: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
      bloque: prev.bloque,
    }),
  })
  .then(rattacher, {
    map: ({ extraireDonnees: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
      bloque: prev.bloque,
    }),
  })
  .then(detecterDoublon, {
    map: ({ rattacher: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
      bloque: prev.bloque,
    }),
  })
  .then(controler, {
    map: ({ detecterDoublon: prev, trigger }) => ({
      cabinet_id: trigger.cabinet_id,
      piece_id: prev.piece_id,
      doublon_flag: prev.doublon_flag,
      bloque: prev.bloque,
    }),
  });

intakeWorkflow.commit();
