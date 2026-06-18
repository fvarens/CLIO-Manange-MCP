/**
 * Clio Grow API client for the MCP server.
 *
 * Fully isolated from the Clio Manage client (lib/clio.ts):
 *  - Different Redis key: `clio_grow_tokens` (vs `clio_tokens`)
 *  - Different API base: `https://grow.clio.com/api` (vs `app.clio.com/api/v4`)
 *  - Different auth: PKCE public client (no secret)
 *  - Token was obtained via the Railway dashboard OAuth flow and stored in the
 *    same Upstash Redis this server reads from.
 */

const CLIO_GROW_API_BASE = "https://grow.clio.com/api";
const REDIS_KEY = "clio_grow_tokens";

interface GrowTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string;
  expires_at: number;
}

let tokenStore: GrowTokens | null = null;

async function persistTokens() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(
      `${url}/set/${REDIS_KEY}/${encodeURIComponent(JSON.stringify(tokenStore))}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    // Redis unavailable
  }
}

async function loadTokens() {
  if (tokenStore) return;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    const res = await fetch(`${url}/get/${REDIS_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.result) {
      tokenStore =
        typeof data.result === "string" ? JSON.parse(data.result) : data.result;
    }
  } catch {
    // Redis unavailable
  }
}

async function refreshAccessToken() {
  if (!tokenStore?.refresh_token) {
    throw new Error(
      "No Grow refresh token. Re-authorize via the dashboard at /dashboard/clio-grow."
    );
  }
  const clientId = process.env.CLIO_GROW_CLIENT_ID;
  if (!clientId) {
    throw new Error("CLIO_GROW_CLIENT_ID env var missing on MCP server.");
  }

  const res = await fetch("https://auth.api.clio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenStore.refresh_token,
      client_id: clientId,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grow token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  tokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokenStore.refresh_token,
    token_type: data.token_type ?? "Bearer",
    scope: data.scope ?? tokenStore.scope,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  await persistTokens();
}

export async function getGrowAccessToken(): Promise<string> {
  await loadTokens();
  if (!tokenStore) {
    throw new Error(
      "Clio Grow not connected. Authorize via the dashboard at /dashboard/clio-grow."
    );
  }
  if (Date.now() > tokenStore.expires_at - 60_000 && tokenStore.refresh_token) {
    await refreshAccessToken();
  }
  return tokenStore.access_token;
}

export async function isGrowAuthenticated(): Promise<boolean> {
  await loadTokens();
  return tokenStore !== null;
}

export async function growApiRequest(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const token = await getGrowAccessToken();

  let url = `${CLIO_GROW_API_BASE}${path}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clio Grow API ${method} ${path}: ${res.status} ${err}`);
  }

  if (res.status === 204) return { success: true };
  return res.json();
}
