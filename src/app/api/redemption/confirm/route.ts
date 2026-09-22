import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { redemptionConfirmSchema } from "@/lib/validation/schemas";
import { confirmRedemption } from "@/lib/services/redemptionService";
import { handleApiError } from "@/lib/api/response";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = redemptionConfirmSchema.parse(await request.json());
    const result = await confirmRedemption(body.quoteId, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
