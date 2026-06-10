import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  recevoirFichierTool,
  analyserOcrTool,
  classifierTool,
  extraireDonneesTool,
  rattacherTool,
  detecterDoublonTool,
  controlerTool,
  consulterPieceTool,
  rechercherPiecesTool,
  corrigerPieceTool,
  recontroleTool,
} from "./tools/index.js";

const server = new McpServer({
  name: "mistra-intake",
  version: "0.1.0",
});

// Enregistrement des 11 tools
server.tool(
  recevoirFichierTool.name,
  recevoirFichierTool.description,
  recevoirFichierTool.inputSchema,
  recevoirFichierTool.execute,
);

server.tool(
  analyserOcrTool.name,
  analyserOcrTool.description,
  analyserOcrTool.inputSchema,
  analyserOcrTool.execute,
);

server.tool(
  classifierTool.name,
  classifierTool.description,
  classifierTool.inputSchema,
  classifierTool.execute,
);

server.tool(
  extraireDonneesTool.name,
  extraireDonneesTool.description,
  extraireDonneesTool.inputSchema,
  extraireDonneesTool.execute,
);

server.tool(
  rattacherTool.name,
  rattacherTool.description,
  rattacherTool.inputSchema,
  rattacherTool.execute,
);

server.tool(
  detecterDoublonTool.name,
  detecterDoublonTool.description,
  detecterDoublonTool.inputSchema,
  detecterDoublonTool.execute,
);

server.tool(
  controlerTool.name,
  controlerTool.description,
  controlerTool.inputSchema,
  controlerTool.execute,
);

server.tool(
  consulterPieceTool.name,
  consulterPieceTool.description,
  consulterPieceTool.inputSchema,
  consulterPieceTool.execute,
);

server.tool(
  rechercherPiecesTool.name,
  rechercherPiecesTool.description,
  rechercherPiecesTool.inputSchema,
  rechercherPiecesTool.execute,
);

server.tool(
  corrigerPieceTool.name,
  corrigerPieceTool.description,
  corrigerPieceTool.inputSchema,
  corrigerPieceTool.execute,
);

server.tool(
  recontroleTool.name,
  recontroleTool.description,
  recontroleTool.inputSchema,
  recontroleTool.execute,
);

// Démarrage
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(JSON.stringify({ level: "info", message: "MCP server mistra-intake démarré" }));
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", message: error.message }));
  process.exit(1);
});
