import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { adminProductUpdateSchema } from "@/lib/validation/schemas";
import { listProducts, updateProductParams } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const products = await listProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = adminProductUpdateSchema.parse(await request.json());
    const product = await updateProductParams({
      productId: body.productId,
      adminWallet: session.walletAddress,
      targetAnnualRateBps: body.targetAnnualRateBps,
      cycleDays: body.cycleDays,
      status: body.status,
    });
    return NextResponse.json({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
