import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDefaultProduct } from "@/lib/services/investmentService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireSession();
    const product = await getDefaultProduct();
    return NextResponse.json({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
