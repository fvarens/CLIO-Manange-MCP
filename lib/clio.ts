const CLIO_CLIENT_ID = process.env.CLIO_CLIENT_ID!;
const CLIO_CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET!;
const CLIO_REDIRECT_URI = process.env.CLIO_REDIRECT_URI!;
const CLIO_API_BASE = "https://app.clio.com";
const CLIO_API_V4 = `${CLIO_API_BASE}/api/v4`;

// Token store
let tokenStore: {
  access_token: string;
  refresh_token: string;
  expires_at: number;
} | null = null;

export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIO_CLIENT_ID,
    redirect_uri: CLIO_REDIRECT_URI,
  });
  return `${CLIO_API_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(`${CLIO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIO_CLIENT_ID,
      client_secret: CLIO_CLIENT_SECRET,
      redirect_uri: CLIO_REDIRECT_URI,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  tokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await persistTokens();
  return tokenStore;
}

async function refreshAccessToken() {
  if (!tokenStore?.refresh_token) {
    throw new Error("No refresh token available. Please re-authorize.");
  }

  const res = await fetch(`${CLIO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenStore.refresh_token,
      client_id: CLIO_CLIENT_ID,
      client_secret: CLIO_CLIENT_SECRET,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  tokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await persistTokens();
  return tokenStore;
}

// Persist tokens to Upstash Redis via REST API
async function persistTokens() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(`${url}/set/clio_tokens/${encodeURIComponent(JSON.stringify(tokenStore))}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Redis not available, tokens stay in memory
  }
}

async function loadTokens() {
  if (tokenStore) return;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  try {
    const res = await fetch(`${url}/get/clio_tokens`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.result) {
      tokenStore = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
    }
  } catch {
    // Redis not available
  }
}

export async function getAccessToken(): Promise<string> {
  await loadTokens();

  if (!tokenStore) {
    throw new Error("Not authenticated. Visit /api/oauth/authorize first.");
  }

  // Refresh if expiring within 5 minutes
  if (Date.now() > tokenStore.expires_at - 5 * 60 * 1000) {
    await refreshAccessToken();
  }

  return tokenStore.access_token;
}

export async function isAuthenticated(): Promise<boolean> {
  await loadTokens();
  return tokenStore !== null;
}

export async function clioApiRequest(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const token = await getAccessToken();

  let url = `${CLIO_API_V4}${path}.json`;
  if (queryParams) {
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
    throw new Error(`Clio API ${method} ${path}: ${res.status} ${err}`);
  }

  if (res.status === 204) return { success: true };
  return res.json();
}
