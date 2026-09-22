import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { redemptionQuoteRequestSchema } from "@/lib/validation/schemas";
import { getPositionById, getProductById } from "@/lib/services/investmentService";
import { createRedemptionQuote } from "@/lib/services/redemptionService";
import { handleApiError, apiError } from "@/lib/api/response";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = redemptionQuoteRequestSchema.parse(await request.json());

    const position = await getPositionById(body.positionId, session.userId);
    if (!position || position.status !== "active") {
      return apiError(404, "not_found", "This investment is not available for redemption.");
    }

    const product = await getProductById(position.product_id);
    const quote = await createRedemptionQuote(position, product);

    return NextResponse.json({ quote });
  } catch (error) {
    return handleApiError(error);
  }
}
