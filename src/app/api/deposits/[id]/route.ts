import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDeposit } from "@/lib/services/depositService";
import { handleApiError, apiError } from "@/lib/api/response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const deposit = await getDeposit(id, session.userId);
    if (!deposit) {
      return apiError(404, "not_found", "Deposit not found.");
    }
    return NextResponse.json({ deposit });
  } catch (error) {
    return handleApiError(error);
  }
}
