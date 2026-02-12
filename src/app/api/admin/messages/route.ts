import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { chatBus } from "@/lib/chat-bus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID required." },
        { status: 400 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const body = await request.json().catch(() => null);
    const { orderId, message } = body ?? {};

    if (!orderId || !message) {
      return NextResponse.json(
        { error: "Order ID and message are required." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const created = await prisma.message.create({
      data: {
        orderId,
        sender: "ADMIN",
        body: String(message),
      },
    });

    chatBus.publish(orderId, {
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
