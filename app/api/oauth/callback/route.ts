import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/clio";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.json({
      success: true,
      message: "CLIO connected successfully! You can close this window.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
