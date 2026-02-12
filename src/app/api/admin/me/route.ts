import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie, verifySessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getSessionCookie(request);
  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ username: payload.u });
}
