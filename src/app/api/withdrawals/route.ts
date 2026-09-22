import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { withdrawalRequestSchema } from "@/lib/validation/schemas";
import { toMinorUnits } from "@/lib/money";
import { requestWithdrawal, listWithdrawals } from "@/lib/services/withdrawalService";
import { handleApiError } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export async function GET() {
  try {
    const session = await requireSession();
    const withdrawals = await listWithdrawals(session.userId);
    return NextResponse.json({ withdrawals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const rate = checkRateLimit(`withdrawals:${session.userId}:${getClientIp(request)}`, 10, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
        { status: 429 }
      );
    }

    const body = withdrawalRequestSchema.parse(await request.json());
    const withdrawal = await requestWithdrawal(session.userId, toMinorUnits(body.amount), body.destinationWallet);
    return NextResponse.json({ withdrawal });
  } catch (error) {
    return handleApiError(error);
  }
}
