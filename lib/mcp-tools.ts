import { clioApiRequest } from "./clio";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function paginationProps() {
  return {
    limit: { type: "number", description: "Max results to return (default 25, max 200)" },
    page: { type: "number", description: "Page number for pagination" },
    order: { type: "string", description: "Sort order, e.g. 'name(asc)' or 'created_at(desc)'" },
  };
}

function fieldsParam(desc: string) {
  return { type: "string", description: `Comma-separated fields to include. ${desc}` };
}

function buildQuery(args: Record<string, unknown>, extraFields?: string): Record<string, string> {
  const q: Record<string, string> = {};
  if (args.limit) q.limit = String(args.limit);
  if (args.page) q.page = String(args.page);
  if (args.order) q.order = String(args.order);
  if (args.fields) q.fields = String(args.fields);
  else if (extraFields) q.fields = extraFields;
  if (args.query) q.query = String(args.query);
  if (args.status) q.status = String(args.status);
  if (args.client_id) q.client_id = String(args.client_id);
  if (args.matter_id) q.matter_id = String(args.matter_id);
  if (args.contact_id) q.contact_id = String(args.contact_id);
  if (args.assignee_id) q.assignee_id = String(args.assignee_id);
  if (args.responsible_attorney_id) q.responsible_attorney_id = String(args.responsible_attorney_id);
  if (args.created_since) q.created_since = String(args.created_since);
  if (args.updated_since) q.updated_since = String(args.updated_since);
  if (args.from) q.from = String(args.from);
  if (args.to) q.to = String(args.to);
  return q;
}

export const tools: ToolDefinition[] = [
  // ==================== MATTERS ====================
  {
    name: "list_matters",
    description: "List all matters with optional filters (status, client, responsible attorney, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,display_number,description,status,client,practice_area"),
        query: { type: "string", description: "Search query" },
        status: { type: "string", description: "Filter by status: Open, Pending, Closed" },
        client_id: { type: "number", description: "Filter by client ID" },
        responsible_attorney_id: { type: "number", description: "Filter by responsible attorney ID" },
        created_since: { type: "string", description: "ISO date - matters created since" },
        updated_since: { type: "string", description: "ISO date - matters updated since" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/matters", undefined, buildQuery(args, "id,display_number,description,status,client,practice_area,responsible_attorney,open_date,close_date,pending_date,billable")),
  },
  {
    name: "get_matter",
    description: "Get a single matter by ID with full details",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Matter ID" },
        fields: fieldsParam("e.g. id,display_number,description,status,client,custom_field_values"),
      },
      required: ["id"],
    },
    handler: async (args) => clioApiRequest("GET", `/matters/${args.id}`, undefined, buildQuery(args, "id,display_number,description,status,client,practice_area,responsible_attorney,originating_attorney,custom_field_values,billable,open_date,close_date,statute_of_limitations")),
  },
  {
    name: "create_matter",
    description: "Create a new matter in Clio",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Matter description/name" },
        status: { type: "string", description: "Open, Pending, or Closed" },
        client_id: { type: "number", description: "Client contact ID" },
        practice_area_id: { type: "number", description: "Practice area ID" },
        responsible_attorney_id: { type: "number", description: "Responsible attorney user ID" },
        originating_attorney_id: { type: "number", description: "Originating attorney user ID" },
        billable: { type: "boolean", description: "Whether the matter is billable" },
        open_date: { type: "string", description: "Open date (YYYY-MM-DD)" },
      },
      required: ["description"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = { description: args.description };
      if (args.status) data.status = args.status;
      if (args.client_id) data.client = { id: args.client_id };
      if (args.practice_area_id) data.practice_area = { id: args.practice_area_id };
      if (args.responsible_attorney_id) data.responsible_attorney = { id: args.responsible_attorney_id };
      if (args.originating_attorney_id) data.originating_attorney = { id: args.originating_attorney_id };
      if (args.billable !== undefined) data.billable = args.billable;
      if (args.open_date) data.open_date = args.open_date;
      return clioApiRequest("POST", "/matters", { data });
    },
  },
  {
    name: "update_matter",
    description: "Update an existing matter",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Matter ID" },
        description: { type: "string", description: "Updated description" },
        status: { type: "string", description: "Open, Pending, or Closed" },
        billable: { type: "boolean", description: "Whether billable" },
        close_date: { type: "string", description: "Close date (YYYY-MM-DD)" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = {};
      if (args.description) data.description = args.description;
      if (args.status) data.status = args.status;
      if (args.billable !== undefined) data.billable = args.billable;
      if (args.close_date) data.close_date = args.close_date;
      return clioApiRequest("PATCH", `/matters/${args.id}`, { data });
    },
  },

  // ==================== CONTACTS ====================
  {
    name: "list_contacts",
    description: "List contacts (people and companies) with optional search",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,name,type,email_addresses,phone_numbers"),
        query: { type: "string", description: "Search by name, email, phone" },
        type: { type: "string", description: "Filter: Person or Company" },
        created_since: { type: "string", description: "ISO date" },
        updated_since: { type: "string", description: "ISO date" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/contacts", undefined, buildQuery(args, "id,name,type,first_name,last_name,email_addresses,phone_numbers,company,created_at")),
  },
  {
    name: "get_contact",
    description: "Get a single contact by ID with full details",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Contact ID" },
        fields: fieldsParam("e.g. id,name,email_addresses,phone_numbers,addresses,custom_field_values"),
      },
      required: ["id"],
    },
    handler: async (args) => clioApiRequest("GET", `/contacts/${args.id}`, undefined, buildQuery(args, "id,name,type,first_name,last_name,title,company,email_addresses,phone_numbers,addresses,web_sites,custom_field_values,created_at,updated_at")),
  },
  {
    name: "create_contact_person",
    description: "Create a person contact",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        title: { type: "string", description: "Title (Mr., Mrs., etc.)" },
        company_id: { type: "number", description: "Associated company contact ID" },
      },
      required: ["first_name"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = { type: "Person", first_name: args.first_name };
      if (args.last_name) data.last_name = args.last_name;
      if (args.title) data.title = args.title;
      if (args.company_id) data.company = { id: args.company_id };
      if (args.email) data.email_addresses = [{ name: "Work", address: args.email, default_email: true }];
      if (args.phone) data.phone_numbers = [{ name: "Work", number: args.phone, default_phone: true }];
      return clioApiRequest("POST", "/contacts", { data });
    },
  },
  {
    name: "create_contact_company",
    description: "Create a company contact",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        website: { type: "string", description: "Website URL" },
      },
      required: ["name"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = { type: "Company", name: args.name };
      if (args.email) data.email_addresses = [{ name: "Work", address: args.email, default_email: true }];
      if (args.phone) data.phone_numbers = [{ name: "Work", number: args.phone, default_phone: true }];
      if (args.website) data.web_sites = [{ name: "Work", address: args.website, default_web_site: true }];
      return clioApiRequest("POST", "/contacts", { data });
    },
  },

  // ==================== TASKS ====================
  {
    name: "list_tasks",
    description: "List tasks with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,name,status,priority,due_at,matter,assignee"),
        matter_id: { type: "number", description: "Filter by matter ID" },
        assignee_id: { type: "number", description: "Filter by assignee ID" },
        status: { type: "string", description: "Filter: Complete or Incomplete" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/tasks", undefined, buildQuery(args, "id,name,description,status,priority,due_at,matter,assignee,completed_at,created_at")),
  },
  {
    name: "create_task",
    description: "Create a new task, optionally linked to a matter",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Task name" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", description: "High, Normal, or Low" },
        due_at: { type: "string", description: "Due date (ISO format)" },
        matter_id: { type: "number", description: "Associated matter ID" },
        assignee_id: { type: "number", description: "Assignee user ID" },
      },
      required: ["name"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = { name: args.name };
      if (args.description) data.description = args.description;
      if (args.priority) data.priority = args.priority;
      if (args.due_at) data.due_at = args.due_at;
      if (args.matter_id) data.matter = { id: args.matter_id };
      if (args.assignee_id) data.assignee = { id: args.assignee_id, type: "User" };
      return clioApiRequest("POST", "/tasks", { data });
    },
  },
  {
    name: "update_task",
    description: "Update an existing task",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Task ID" },
        name: { type: "string", description: "Updated name" },
        status: { type: "string", description: "Complete or Incomplete" },
        priority: { type: "string", description: "High, Normal, or Low" },
        due_at: { type: "string", description: "Updated due date" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = {};
      if (args.name) data.name = args.name;
      if (args.status) data.status = args.status;
      if (args.priority) data.priority = args.priority;
      if (args.due_at) data.due_at = args.due_at;
      return clioApiRequest("PATCH", `/tasks/${args.id}`, { data });
    },
  },

  // ==================== ACTIVITIES (Time & Expenses) ====================
  {
    name: "list_activities",
    description: "List time entries and activities",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,type,date,quantity,price,total,matter,user"),
        matter_id: { type: "number", description: "Filter by matter ID" },
        contact_id: { type: "number", description: "Filter by contact ID" },
        from: { type: "string", description: "Start date (YYYY-MM-DD)" },
        to: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/activities", undefined, buildQuery(args, "id,type,date,quantity,price,total,note,matter,user,activity_description,billed,created_at")),
  },
  {
    name: "create_time_entry",
    description: "Create a time entry for a matter",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "number", description: "Matter ID" },
        user_id: { type: "number", description: "User ID for the timekeeper" },
        date: { type: "string", description: "Date (YYYY-MM-DD)" },
        quantity: { type: "number", description: "Time in hours (e.g. 1.5)" },
        note: { type: "string", description: "Description of work performed" },
        activity_description_id: { type: "number", description: "Activity description ID" },
        non_billable: { type: "boolean", description: "Mark as non-billable" },
      },
      required: ["matter_id", "date", "quantity"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = {
        type: "TimeEntry",
        date: args.date,
        quantity: Number(args.quantity) * 3600, // Clio expects seconds
        matter: { id: args.matter_id },
      };
      if (args.user_id) data.user = { id: args.user_id };
      if (args.note) data.note = args.note;
      if (args.activity_description_id) data.activity_description = { id: args.activity_description_id };
      if (args.non_billable) data.non_billable = args.non_billable;
      return clioApiRequest("POST", "/activities", { data });
    },
  },

  // ==================== BILLING ====================
  {
    name: "list_bills",
    description: "List bills with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,number,issued_at,due_at,total,balance,state,matter,client"),
        matter_id: { type: "number", description: "Filter by matter ID" },
        client_id: { type: "number", description: "Filter by client ID" },
        status: { type: "string", description: "Filter: draft, awaiting_approval, awaiting_payment, paid, void, deleted" },
        created_since: { type: "string", description: "ISO date" },
      },
    },
    handler: async (args) => {
      const q = buildQuery(args, "id,number,issued_at,due_at,total,balance,state,matter,client,created_at");
      if (args.status) q.state = String(args.status);
      return clioApiRequest("GET", "/bills", undefined, q);
    },
  },
  {
    name: "get_bill",
    description: "Get a single bill by ID with full details including line items",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Bill ID" },
      },
      required: ["id"],
    },
    handler: async (args) => clioApiRequest("GET", `/bills/${args.id}`, undefined, { fields: "id,number,issued_at,due_at,total,balance,state,matter,client,line_items,created_at" }),
  },

  // ==================== CALENDAR ====================
  {
    name: "list_calendar_entries",
    description: "List calendar entries within a date range",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,summary,start_at,end_at,location,matter,attendees"),
        from: { type: "string", description: "Start date (YYYY-MM-DD)" },
        to: { type: "string", description: "End date (YYYY-MM-DD)" },
        matter_id: { type: "number", description: "Filter by matter ID" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/calendar_entries", undefined, buildQuery(args, "id,summary,description,start_at,end_at,all_day,location,matter,calendar_owner,attendees,created_at")),
  },
  {
    name: "create_calendar_entry",
    description: "Create a calendar entry",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title/summary" },
        description: { type: "string", description: "Event description" },
        start_at: { type: "string", description: "Start time (ISO format)" },
        end_at: { type: "string", description: "End time (ISO format)" },
        location: { type: "string", description: "Location" },
        matter_id: { type: "number", description: "Associated matter ID" },
        all_day: { type: "boolean", description: "All day event" },
      },
      required: ["summary", "start_at", "end_at"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = {
        summary: args.summary,
        start_at: args.start_at,
        end_at: args.end_at,
      };
      if (args.description) data.description = args.description;
      if (args.location) data.location = args.location;
      if (args.matter_id) data.matter = { id: args.matter_id };
      if (args.all_day !== undefined) data.all_day = args.all_day;
      return clioApiRequest("POST", "/calendar_entries", { data });
    },
  },

  // ==================== COMMUNICATIONS ====================
  {
    name: "list_communications",
    description: "List logged communications (calls, emails, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,subject,type,date,matter,senders,receivers"),
        matter_id: { type: "number", description: "Filter by matter ID" },
        contact_id: { type: "number", description: "Filter by contact ID" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/communications", undefined, buildQuery(args, "id,subject,body,type,date,matter,senders,receivers,created_at")),
  },

  // ==================== DOCUMENTS ====================
  {
    name: "list_documents",
    description: "List documents, optionally filtered by matter",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,name,content_type,matter,created_at"),
        matter_id: { type: "number", description: "Filter by matter ID" },
        query: { type: "string", description: "Search by document name" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/documents", undefined, buildQuery(args, "id,name,content_type,latest_document_version,matter,creator,created_at,updated_at")),
  },
  {
    name: "list_folders",
    description: "List document folders, optionally filtered by matter",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        matter_id: { type: "number", description: "Filter by matter ID" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/folders", undefined, buildQuery(args, "id,name,type,parent,matter,created_at")),
  },

  // ==================== USERS ====================
  {
    name: "list_users",
    description: "List all users in the Clio account",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        fields: fieldsParam("e.g. id,name,email,enabled,role"),
        query: { type: "string", description: "Search by name or email" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/users", undefined, buildQuery(args, "id,name,email,enabled,role,created_at")),
  },
  {
    name: "get_user",
    description: "Get a single user by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "User ID" },
      },
      required: ["id"],
    },
    handler: async (args) => clioApiRequest("GET", `/users/${args.id}`, undefined, { fields: "id,name,email,enabled,role,rate,created_at" }),
  },

  // ==================== PRACTICE AREAS ====================
  {
    name: "list_practice_areas",
    description: "List all practice areas configured in Clio",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
      },
    },
    handler: async (args) => clioApiRequest("GET", "/practice_areas", undefined, buildQuery(args, "id,name,code,created_at")),
  },

  // ==================== CUSTOM FIELDS ====================
  {
    name: "list_custom_fields",
    description: "List all custom field definitions",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
      },
    },
    handler: async (args) => clioApiRequest("GET", "/custom_fields", undefined, buildQuery(args, "id,name,field_type,parent_type,picklist_options,created_at")),
  },

  // ==================== NOTES ====================
  {
    name: "list_notes",
    description: "List notes, optionally filtered by matter or contact",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        matter_id: { type: "number", description: "Filter by matter ID" },
        contact_id: { type: "number", description: "Filter by contact ID" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/notes", undefined, buildQuery(args, "id,subject,detail,date,type,matter,contact,created_at")),
  },
  {
    name: "create_note",
    description: "Create a note on a matter or contact",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Note subject" },
        detail: { type: "string", description: "Note body/detail" },
        matter_id: { type: "number", description: "Matter ID to attach note to" },
        contact_id: { type: "number", description: "Contact ID to attach note to" },
        date: { type: "string", description: "Date (YYYY-MM-DD)" },
      },
      required: ["subject"],
    },
    handler: async (args) => {
      const data: Record<string, unknown> = { subject: args.subject };
      if (args.detail) data.detail = args.detail;
      if (args.matter_id) data.regarding = { id: args.matter_id, type: "Matter" };
      if (args.contact_id) data.regarding = { id: args.contact_id, type: "Contact" };
      if (args.date) data.date = args.date;
      return clioApiRequest("POST", "/notes", { data });
    },
  },

  // ==================== RELATIONSHIPS ====================
  {
    name: "list_relationships",
    description: "List relationships (matter-contact associations)",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
        matter_id: { type: "number", description: "Filter by matter ID" },
        contact_id: { type: "number", description: "Filter by contact ID" },
      },
    },
    handler: async (args) => clioApiRequest("GET", "/relationships", undefined, buildQuery(args, "id,description,matter,contact,created_at")),
  },

  // ==================== TRUST ACCOUNTS ====================
  {
    name: "list_trust_accounts",
    description: "List trust/IOLTA account balances",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProps(),
      },
    },
    handler: async (args) => clioApiRequest("GET", "/bank_accounts", undefined, buildQuery(args, "id,name,type,balance,bank_name,currency,created_at")),
  },

  // ==================== GENERIC API ====================
  {
    name: "clio_api_request",
    description: "Make a raw API request to any Clio v4 endpoint. Use this for endpoints not covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", description: "HTTP method: GET, POST, PATCH, PUT, DELETE" },
        path: { type: "string", description: "API path after /api/v4, e.g. /matters or /contacts/123. Do NOT include .json" },
        body: { type: "object", description: "Request body for POST/PATCH/PUT" },
        query_params: { type: "object", description: "Query parameters as key-value pairs" },
      },
      required: ["method", "path"],
    },
    handler: async (args) => {
      const qp = args.query_params as Record<string, string> | undefined;
      return clioApiRequest(String(args.method), String(args.path), args.body, qp);
    },
  },

  // ==================== STATUS ====================
  {
    name: "connection_status",
    description: "Check if the CLIO connection is authenticated and working",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      try {
        const result = await clioApiRequest("GET", "/users/who_am_i", undefined, { fields: "id,name,email" });
        return { connected: true, user: result };
      } catch (e) {
        return { connected: false, error: String(e) };
      }
    },
  },
];
