import { NextRequest, NextResponse } from "next/server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const normalizeCode = (value: string) => value.trim().toUpperCase();

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { code, fullName, email, roomLink, city } = body as Record<
    string,
    string
  >;

  if (!code || !fullName || !email || !city) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  const normalizedCode = normalizeCode(code);

  try {
    const order = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
      const redemption = await tx.redemptionCode.findUnique({
        where: { code: normalizedCode },
      });

      if (!redemption) {
        throw new Error("INVALID_CODE");
      }

      if (redemption.status === "REDEEMED") {
        throw new Error("CODE_REDEEMED");
      }

      const created = await tx.order.create({
        data: {
          codeId: redemption.id,
          fullName,
          email,
          roomLink: roomLink ? String(roomLink) : null,
          city,
          stage: "NEW",
        },
      });

      await tx.message.create({
        data: {
          orderId: created.id,
          sender: "CUSTOMER",
          body: "Booking request submitted.",
        },
      });

      await tx.redemptionCode.update({
        where: { id: redemption.id },
        data: { status: "REDEEMED", redeemedAt: new Date() },
      });

        return created;
      }
    );

    return NextResponse.json({ orderId: order.id, code: normalizedCode });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_CODE") {
        return NextResponse.json({ error: "Code not found." }, { status: 404 });
      }
      if (error.message === "CODE_REDEEMED") {
        return NextResponse.json(
          { error: "This code was already redeemed." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Unable to redeem code." },
      { status: 500 }
    );
  }
}
