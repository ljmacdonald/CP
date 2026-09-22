import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { depositVerifySchema } from "@/lib/validation/schemas";
import { verifyAndConfirmDeposit } from "@/lib/services/depositService";
import { handleApiError } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const rate = checkRateLimit(`deposits:verify:${session.userId}:${getClientIp(request)}`, 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
        { status: 429 }
      );
    }

    const body = depositVerifySchema.parse(await request.json());
    const result = await verifyAndConfirmDeposit(body.depositId, session.userId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
