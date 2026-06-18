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

  // The authorization_code grant must return a refresh token. If it does not,
  // fail loudly here instead of silently storing a record that cannot refresh.
  if (!data.refresh_token) {
    throw new Error(
      "Clio did not return a refresh_token on authorization. Re-authorize and ensure offline access is granted."
    );
  }

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

  // Capture the existing refresh token BEFORE the request so we never lose it.
  const existingRefreshToken = tokenStore.refresh_token;

  const res = await fetch(`${CLIO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: existingRefreshToken,
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
    // ROOT-CAUSE FIX: Clio does not always echo a refresh_token on refresh.
    // Keep the existing one when the response omits it, so we never overwrite
    // a good refresh token with undefined (which caused the prior outage).
    refresh_token: data.refresh_token ?? existingRefreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await persistTokens();
  return tokenStore;
}

// Persist tokens to Upstash Redis via REST API.
// Uses a POST body for the value instead of putting JSON in the URL path,
// which avoids URL-length and encoding edge cases.
async function persistTokens() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("[clio] KV not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing). Tokens are in-memory only and will be lost on cold start.");
    return;
  }

  try {
    const res = await fetch(`${url}/set/clio_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(tokenStore),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[clio] Failed to persist tokens to KV: ${res.status} ${body}`);
    }
  } catch (e) {
    console.error("[clio] Error persisting tokens to KV:", e);
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
    if (!res.ok) {
      const body = await res.text();
      console.error(`[clio] Failed to load tokens from KV: ${res.status} ${body}`);
      return;
    }
    const data = await res.json();
    if (data.result) {
      const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      // Guard: ignore a stored record that has no refresh token. Better to force
      // a clean re-auth than to load a record that can never refresh.
      if (parsed && parsed.refresh_token) {
        tokenStore = parsed;
      } else {
        console.error("[clio] Stored token record has no refresh_token; ignoring it. Re-authorization required.");
      }
    }
  } catch (e) {
    console.error("[clio] Error loading tokens from KV:", e);
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
