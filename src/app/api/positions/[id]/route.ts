import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  getPositionById,
  getPositionWithLiveValue,
  getProductById,
  getPerformanceSeries,
} from "@/lib/services/investmentService";
import { listTransactions } from "@/lib/services/transactionsService";
import { handleApiError, apiError } from "@/lib/api/response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const position = await getPositionById(id, session.userId);
    if (!position) {
      return apiError(404, "not_found", "Investment not found.");
    }

    const product = await getProductById(position.product_id);
    const [withLiveValue, performance, transactions] = await Promise.all([
      getPositionWithLiveValue(position, product),
      getPerformanceSeries(position, product),
      listTransactions({ userId: session.userId, limit: 50 }),
    ]);

    return NextResponse.json({ position: withLiveValue, performance, transactions });
  } catch (error) {
    return handleApiError(error);
  }
}
