import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/clio";

export async function GET() {
  return NextResponse.redirect(getAuthorizationUrl());
}
