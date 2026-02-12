import { NextRequest, NextResponse } from "next/server";

import { chatBus, MessagePayload } from "@/lib/chat-bus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const normalizeCode = (value: string) => value.trim().toUpperCase();

export async function GET(request: NextRequest) {
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: MessagePayload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      const unsubscribe = chatBus.subscribe(redemption.order!.id, send);

      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));

      return () => unsubscribe();
    },
    cancel() {
      return;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
