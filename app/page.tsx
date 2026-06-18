export default function Home() {
  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 600, margin: "80px auto", padding: "0 20px" }}>
      <h1>CLIO MCP Server</h1>
      <p>Full CLIO Manage API integration for Claude Code and dashboards.</p>

      <h2>Setup</h2>
      <ol>
        <li>
          <a href="/api/oauth/authorize">Connect to CLIO</a> — Authorize this app with your CLIO account
        </li>
        <li>Add the MCP endpoint to Claude Code</li>
      </ol>

      <h2>Endpoints</h2>
      <ul>
        <li><code>GET /api/oauth/authorize</code> — Start CLIO OAuth</li>
        <li><code>GET /api/oauth/callback</code> — OAuth callback</li>
        <li><code>POST /api/mcp</code> — MCP endpoint (for Claude Code)</li>
        <li><code>GET /api/clio?path=/matters</code> — Dashboard API proxy</li>
      </ul>

      <h2>Available MCP Tools</h2>
      <ul>
        <li><strong>Matters:</strong> list, get, create, update</li>
        <li><strong>Contacts:</strong> list, get, create person, create company</li>
        <li><strong>Tasks:</strong> list, create, update</li>
        <li><strong>Activities:</strong> list, create time entry</li>
        <li><strong>Billing:</strong> list bills, get bill</li>
        <li><strong>Calendar:</strong> list entries, create entry</li>
        <li><strong>Communications:</strong> list</li>
        <li><strong>Documents:</strong> list documents, list folders</li>
        <li><strong>Users:</strong> list, get</li>
        <li><strong>Notes:</strong> list, create</li>
        <li><strong>Practice Areas:</strong> list</li>
        <li><strong>Custom Fields:</strong> list definitions</li>
        <li><strong>Relationships:</strong> list</li>
        <li><strong>Trust Accounts:</strong> list</li>
        <li><strong>Generic:</strong> raw API request to any endpoint</li>
        <li><strong>Status:</strong> connection check</li>
      </ul>
    </div>
  );
}
