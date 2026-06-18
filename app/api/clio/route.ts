import { NextRequest, NextResponse } from "next/server";
import { clioApiRequest, isAuthenticated } from "@/lib/clio";

// Generic dashboard API: GET /api/clio?path=/matters&limit=10&fields=id,name
export async function GET(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Not authenticated. Visit /api/oauth/authorize first." },
      { status: 401 }
    );
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json(
      { error: "Missing 'path' query param, e.g. ?path=/matters" },
      { status: 400 }
    );
  }

  const queryParams: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "path") queryParams[key] = value;
  });

  try {
    const result = await clioApiRequest("GET", path, undefined, queryParams);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/clio for write operations
export async function POST(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Not authenticated. Visit /api/oauth/authorize first." },
      { status: 401 }
    );
  }

  try {
    const { method, path, body, query_params } = await req.json();

    if (!method || !path) {
      return NextResponse.json(
        { error: "Missing 'method' and/or 'path' in request body" },
        { status: 400 }
      );
    }

    const result = await clioApiRequest(method, path, body, query_params);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
