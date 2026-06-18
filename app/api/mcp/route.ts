import { NextRequest } from "next/server";
import { tools } from "@/lib/mcp-tools";
import { growTools } from "@/lib/grow-tools";
import { isAuthenticated } from "@/lib/clio";
import { isGrowAuthenticated } from "@/lib/clio-grow";
import { randomUUID } from "crypto";

const allTools = [...tools, ...growTools];

const SESSION_ID = randomUUID();

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Mcp-Session-Id": SESSION_ID,
    },
  });
}

function sseResponse(events: unknown[]): Response {
  const body = events
    .map((data) => `event: message\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Mcp-Session-Id": SESSION_ID,
    },
  });
}

function acceptedResponse(): Response {
  return new Response(null, {
    status: 202,
    headers: { "Mcp-Session-Id": SESSION_ID },
  });
}

async function handleMessage(body: Record<string, unknown>): Promise<unknown | null> {
  const { method, id, params } = body as {
    method: string;
    id?: string | number;
    params?: Record<string, unknown>;
  };

  // Notifications have no id — return null (caller sends 202)
  if (id === undefined || id === null) {
    return null;
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "clio-mcp-server",
          version: "1.0.0",
        },
      },
    };
  }

  if (method === "tools/list") {
    const toolList = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: toolList },
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name as string;
    const toolArgs = (params?.arguments || {}) as Record<string, unknown>;

    const tool = allTools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      };
    }

    // Auth check: Grow tools check Grow auth, Manage tools check Manage auth
    const isGrowTool = toolName.startsWith("grow_");
    const skipAuthCheck =
      toolName === "connection_status" || toolName === "grow_connection_status";

    if (!skipAuthCheck) {
      if (isGrowTool) {
        const authed = await isGrowAuthenticated();
        if (!authed) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: "Clio Grow not connected. Authorize via the dashboard at /dashboard/clio-grow.",
                },
              ],
              isError: true,
            },
          };
        }
      } else {
        const authed = await isAuthenticated();
        if (!authed) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: "Not authenticated. Visit /api/oauth/authorize to connect CLIO.",
                },
              ],
              isError: true,
            },
          };
        }
      }
    }

    try {
      const result = await tool.handler(toolArgs);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (e) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${String(e)}` }],
          isError: true,
        },
      };
    }
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

export async function POST(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  const preferSSE = accept.includes("text/event-stream");

  try {
    const body = await req.json();

    // Handle batch requests (array of messages)
    if (Array.isArray(body)) {
      const results: unknown[] = [];
      for (const msg of body) {
        const result = await handleMessage(msg);
        if (result !== null) results.push(result);
      }
      if (results.length === 0) return acceptedResponse();
      // Batch always uses SSE (multiple events)
      return sseResponse(results);
    }

    // Single message
    const result = await handleMessage(body);
    if (result === null) return acceptedResponse();

    // Use JSON for single responses unless client explicitly prefers SSE
    if (preferSSE) {
      return sseResponse([result]);
    }
    return jsonResponse(result);
  } catch (e) {
    const errPayload = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: String(e) },
    };
    return jsonResponse(errPayload);
  }
}

export async function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function DELETE() {
  return new Response(null, {
    status: 200,
    headers: { "Mcp-Session-Id": SESSION_ID },
  });
}
