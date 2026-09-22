import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { depositIntentSchema } from "@/lib/validation/schemas";
import { toMinorUnits } from "@/lib/money";
import { createDepositIntent } from "@/lib/services/depositService";
import { handleApiError } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const rate = checkRateLimit(`deposits:intent:${session.userId}:${getClientIp(request)}`, 10, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
        { status: 429 }
      );
    }

    const body = depositIntentSchema.parse(await request.json());
    const requestedAmountMinorUnits = toMinorUnits(body.amount);

    const intent = await createDepositIntent(session.userId, session.walletAddress, requestedAmountMinorUnits);

    return NextResponse.json({
      depositId: intent.deposit.id,
      destinationWallet: intent.destinationWallet,
      expectedLamports: intent.expectedLamports,
      requestedAmountMinorUnits: intent.deposit.requested_amount_minor_units,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
