import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { depositSubmitSchema } from "@/lib/validation/schemas";
import { recordSubmittedSignature } from "@/lib/services/depositService";
import { handleApiError } from "@/lib/api/response";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = depositSubmitSchema.parse(await request.json());
    const deposit = await recordSubmittedSignature(body.depositId, session.userId, body.transactionSignature);
    return NextResponse.json({ deposit });
  } catch (error) {
    return handleApiError(error);
  }
}
