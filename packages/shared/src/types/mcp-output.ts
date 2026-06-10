import { z } from "zod";

// Output standard pour tous les tools MCP
export const McpOutputSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).optional(),
  metadata: z.object({
    tool: z.string(),
    duration_ms: z.number(),
    timestamp: z.string(),
  }).optional(),
});

export type McpOutput<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  warnings?: Array<{
    code: string;
    message: string;
  }>;
  metadata?: {
    tool: string;
    duration_ms: number;
    timestamp: string;
  };
};

// Helper pour construire un output standardisé
export function mcpSuccess<T>(
  tool: string,
  data: T,
  warnings?: Array<{ code: string; message: string }>,
): McpOutput<T> {
  return {
    success: true,
    data,
    warnings: warnings?.length ? warnings : undefined,
    metadata: {
      tool,
      duration_ms: 0, // sera rempli par le wrapper
      timestamp: new Date().toISOString(),
    },
  };
}

export function mcpError(
  tool: string,
  code: string,
  message: string,
): McpOutput {
  return {
    success: false,
    error: { code, message },
    metadata: {
      tool,
      duration_ms: 0,
      timestamp: new Date().toISOString(),
    },
  };
}
