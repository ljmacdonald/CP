import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getActivePosition, getPositionWithLiveValue, getProductById } from "@/lib/services/investmentService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireSession();
    const position = await getActivePosition(session.userId);
    if (!position) {
      return NextResponse.json({ position: null });
    }
    const product = await getProductById(position.product_id);
    const withLiveValue = await getPositionWithLiveValue(position, product);
    return NextResponse.json({ position: withLiveValue });
  } catch (error) {
    return handleApiError(error);
  }
}
