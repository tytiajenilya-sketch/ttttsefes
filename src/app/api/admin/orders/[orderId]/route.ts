import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const { orderId } = await params;

  const body = await request.json().catch(() => null);
  const stage = body?.stage;
  const allowedStages = [
    "NEW",
    "CONTACTING",
    "BOOKED",
    "CANCELLED",
    "COMPLETED",
  ];

  if (!allowedStages.includes(stage)) {
    return NextResponse.json(
      { error: "Invalid order stage." },
      { status: 400 }
    );
  }

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { stage },
  });

  return NextResponse.json({ order: updated });
}
