import { NextRequest, NextResponse } from "next/server";

import { chatBus } from "@/lib/chat-bus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const normalizeCode = (value: string) => value.trim().toUpperCase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Code required." }, { status: 400 });
    }

    const normalizedCode = normalizeCode(code);

    const redemption = await prisma.redemptionCode.findUnique({
      where: { code: normalizedCode },
      include: { order: true },
    });

    if (!redemption || !redemption.order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { orderId: redemption.order.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      order: redemption.order,
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { code, message } = body ?? {};

    if (!code || !message) {
      return NextResponse.json(
        { error: "Code and message are required." },
        { status: 400 }
      );
    }

    const normalizedCode = normalizeCode(code);

    const redemption = await prisma.redemptionCode.findUnique({
      where: { code: normalizedCode },
      include: { order: true },
    });

    if (!redemption || !redemption.order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const created = await prisma.message.create({
      data: {
        orderId: redemption.order.id,
        sender: "CUSTOMER",
        body: String(message),
      },
    });

    chatBus.publish(redemption.order.id, {
      id: created.id,
      orderId: created.orderId,
      sender: created.sender,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    });

    return NextResponse.json({ message: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
