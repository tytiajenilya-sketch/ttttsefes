import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { code: true },
  });

  return NextResponse.json({ orders });
}
