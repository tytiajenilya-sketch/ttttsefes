import { NextRequest, NextResponse } from "next/server";

import { buildSessionCookie, createSessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { username, password } = body ?? {};

  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json(
      { error: "Admin credentials not configured." },
      { status: 500 }
    );
  }

  if (username !== adminUser || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = createSessionToken(adminUser);
  if (!token) {
    return NextResponse.json(
      { error: "Unable to create session." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildSessionCookie(token));
  return response;
}
