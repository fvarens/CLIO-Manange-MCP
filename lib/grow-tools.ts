import { growApiRequest, isGrowAuthenticated } from "./clio-grow";
import type { ToolDefinition } from "./mcp-tools";

function paginationProps() {
  return {
    limit: {
      type: "number",
      description: "Max results to return (default 25)",
    },
    offset: {
      type: "number",
      description: "Offset for pagination",
    },
  };
}

function buildQuery(args: Record<string, unknown>): Record<string, string> {
  const q: Record<string, string> = {};
  if (args.limit) q.limit = String(args.limit);
  if (args.offset) q.offset = String(args.offset);
  if (args.query) q.query = String(args.query);
  if (args.status) q.status = String(args.status);
  if (args.source) q.source = String(args.source);
  if (args.created_since) q.created_since = String(args.created_since);
  if (args.updated_since) q.updated_since = String(args.updated_since);
  return q;
}

export const growTools: ToolDefinition[] = [
  // ==================== CONNECTION STATUS ====================
  {
    name: "grow_connection_status",
    description:
      "Check if the Clio Grow integration is connected and has a valid token.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const connected = await isGrowAuthenticated();
      return {
        connected,
        message: connected
          ? "Clio Grow is connected and ready."
          : "Clio Grow is not connected. Authorize via the dashboard at /dashboard/clio-grow.",
      };
    },
  },

  // ==================== LEAD INBOX ====================
  {
    name: "grow_list_leads",
    description:
      "List leads from Clio Grow's lead inbox with optional filters (status, source, date range).",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        status: {
          type: "string",
          description:
            "Filter by lead status (e.g. new, contacted, qualified, converted, lost)",
        },
        source: {
          type: "string",
          description: "Filter by lead source (e.g. website, referral, google_ads)",
        },
        query: {
          type: "string",
          description: "Search query across lead names/emails",
        },
        created_since: {
          type: "string",
          description: "ISO date — only leads created since this date",
        },
        updated_since: {
          type: "string",
          description: "ISO date — only leads updated since this date",
        },
      },
    },
    handler: async (args) =>
      growApiRequest("GET", "/lead_inbox/leads", undefined, buildQuery(args)),
  },
  {
    name: "grow_get_lead",
    description: "Get a single lead by ID with full details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Lead ID" },
      },
      required: ["id"],
    },
    handler: async (args) =>
      growApiRequest("GET", `/lead_inbox/leads/${args.id}`),
  },

  // ==================== CONTACTS ====================
  {
    name: "grow_list_contacts",
    description: "List contacts from Clio Grow with optional search.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        query: { type: "string", description: "Search query for contacts" },
      },
    },
    handler: async (args) =>
      growApiRequest("GET", "/contacts", undefined, buildQuery(args)),
  },
  {
    name: "grow_get_contact",
    description: "Get a single Clio Grow contact by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Contact ID" },
      },
      required: ["id"],
    },
    handler: async (args) =>
      growApiRequest("GET", `/contacts/${args.id}`),
  },

  // ==================== CONTACT NOTES ====================
  {
    name: "grow_list_contact_notes",
    description: "List notes on a Clio Grow contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "number", description: "Contact ID" },
        ...paginationProps(),
      },
      required: ["contact_id"],
    },
    handler: async (args) =>
      growApiRequest(
        "GET",
        `/contacts/${args.contact_id}/notes`,
        undefined,
        buildQuery(args)
      ),
  },
  {
    name: "grow_create_contact_note",
    description: "Add a note to a Clio Grow contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "number", description: "Contact ID" },
        content: { type: "string", description: "Note content (text or HTML)" },
      },
      required: ["contact_id", "content"],
    },
    handler: async (args) =>
      growApiRequest("POST", `/contacts/${args.contact_id}/notes`, {
        note: { content: args.content },
      }),
  },

  // ==================== MATTERS ====================
  {
    name: "grow_list_matters",
    description: "List matters from Clio Grow with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        query: { type: "string", description: "Search query" },
        status: { type: "string", description: "Filter by matter status" },
      },
    },
    handler: async (args) =>
      growApiRequest("GET", "/matters", undefined, buildQuery(args)),
  },
  {
    name: "grow_get_matter",
    description: "Get a single Clio Grow matter by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Matter ID" },
      },
      required: ["id"],
    },
    handler: async (args) =>
      growApiRequest("GET", `/matters/${args.id}`),
  },

  // ==================== MATTER NOTES ====================
  {
    name: "grow_list_matter_notes",
    description: "List notes on a Clio Grow matter.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "number", description: "Matter ID" },
        ...paginationProps(),
      },
      required: ["matter_id"],
    },
    handler: async (args) =>
      growApiRequest(
        "GET",
        `/matters/${args.matter_id}/notes`,
        undefined,
        buildQuery(args)
      ),
  },
  {
    name: "grow_create_matter_note",
    description: "Add a note to a Clio Grow matter.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "number", description: "Matter ID" },
        content: { type: "string", description: "Note content (text or HTML)" },
      },
      required: ["matter_id", "content"],
    },
    handler: async (args) =>
      growApiRequest("POST", `/matters/${args.matter_id}/notes`, {
        note: { content: args.content },
      }),
  },

  // ==================== CUSTOM ACTIONS ====================
  {
    name: "grow_list_custom_actions",
    description: "List available custom actions in Clio Grow.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
      },
    },
    handler: async (args) =>
      growApiRequest("GET", "/custom_actions", undefined, buildQuery(args)),
  },

  // ==================== USERS ====================
  {
    name: "grow_list_users",
    description: "List Clio Grow users (staff/team members) in the firm.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
      },
    },
    handler: async (args) =>
      growApiRequest("GET", "/users", undefined, buildQuery(args)),
  },
];
