import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const normalizeCode = (value: string) => value.trim().toUpperCase();
const allowedRanges = ["150-250", "250-500", "500-750"] as const;

const generateCode = (range: (typeof allowedRanges)[number]) => {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `AS-${random}(${range})`.toUpperCase();
};

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const codes = await prisma.redemptionCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ codes });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (body?.mode === "generate") {
    const range = typeof body.range === "string" ? body.range : "";
    const count = Number(body.count ?? 0);

    if (!allowedRanges.includes(range as (typeof allowedRanges)[number])) {
      return NextResponse.json(
        { error: "Invalid price range." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(count) || count <= 0 || count > 200) {
      return NextResponse.json(
        { error: "Count must be between 1 and 200." },
        { status: 400 }
      );
    }

    const generated = Array.from({ length: count }, () => generateCode(range));

    const existing = await prisma.redemptionCode.findMany({
      where: { code: { in: generated } },
      select: { code: true },
    });

    const existingSet = new Set(existing.map((item) => item.code));
    const toCreate = generated.filter((code) => !existingSet.has(code));

    const result = await prisma.redemptionCode.createMany({
      data: toCreate.map((code) => ({ code })),
    });

    return NextResponse.json({ created: result.count, codes: toCreate });
  }

  const rawCodes = Array.isArray(body?.codes) ? body.codes : [];
  const normalized = rawCodes
    .map((code: string) => normalizeCode(String(code)))
    .filter(Boolean);

  if (normalized.length === 0) {
    return NextResponse.json(
      { error: "No valid codes provided." },
      { status: 400 }
    );
  }

  const existing = await prisma.redemptionCode.findMany({
    where: { code: { in: normalized } },
    select: { code: true },
  });

  const existingSet = new Set(existing.map((item) => item.code));
  const toCreate = normalized.filter((code: string) => !existingSet.has(code));

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  const result = await prisma.redemptionCode.createMany({
    data: toCreate.map((code: string) => ({ code })),
  });

  return NextResponse.json({ created: result.count });
}
