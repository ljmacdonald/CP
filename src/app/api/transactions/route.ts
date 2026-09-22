import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { transactionsQuerySchema } from "@/lib/validation/schemas";
import { listTransactions } from "@/lib/services/transactionsService";
import { handleApiError } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const query = transactionsQuerySchema.parse({
      type: searchParams.get("type") ?? undefined,
    });
    const transactions = await listTransactions({ userId: session.userId, type: query.type });
    return NextResponse.json({ transactions });
  } catch (error) {
    return handleApiError(error);
  }
}
