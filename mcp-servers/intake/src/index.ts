import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ZodRawShape } from "zod";
import type { McpOutput } from "@mistra/shared";
import {
  recevoirFichierTool,
  analyserOcrTool,
  classifierTool,
  extraireDonneesTool,
  rattacherTool,
  controlerTool,
  consulterPieceTool,
  rechercherPiecesTool,
  corrigerPieceTool,
} from "./tools/index.js";

// Forme commune de tous les tools intake (le schéma zod complet, pas sa shape)
type IntakeTool = {
  name: string;
  description: string;
  inputSchema: { shape: ZodRawShape };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (input: any) => Promise<McpOutput<unknown>>;
};

const tools: IntakeTool[] = [
  recevoirFichierTool,
  analyserOcrTool,
  classifierTool,
  extraireDonneesTool,
  rattacherTool,
  controlerTool,
  consulterPieceTool,
  rechercherPiecesTool,
  corrigerPieceTool,
];

const server = new McpServer({
  name: "mistra-intake",
  version: "0.1.0",
});

// Enregistrement unique pour tous les tools :
// - le SDK MCP attend la "shape" du schéma zod (z.object(...).shape), pas l'objet zod entier
// - la réponse doit être au format MCP { content: [...] } ; le résultat métier (McpOutput)
//   est sérialisé en JSON dans un bloc texte
for (const tool of tools) {
  server.tool(tool.name, tool.description, tool.inputSchema.shape, async (input) => {
    const result = await tool.execute(input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  });
}

// Démarrage
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr obligatoire : en stdio, stdout est réservé au protocole JSON-RPC
  console.error(JSON.stringify({ level: "info", message: `MCP server mistra-intake démarré (${tools.length} tools)` }));
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", message: error.message }));
  process.exit(1);
});
