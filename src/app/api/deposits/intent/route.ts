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
      expectedUsdcBaseUnits: intent.expectedUsdcBaseUnits,
      // Sent as the bigint we already hold in memory rather than the row
      // Supabase just returned: PostgREST serializes `bigint` columns as a
      // plain JSON number, not a string, so round-tripping through the DB
      // row here would silently re-introduce the same string/bigint contract
      // violation formatMinorUnits now merely tolerates rather than relies on.
      requestedAmountMinorUnits: requestedAmountMinorUnits.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
