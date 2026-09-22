import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { listRecentWithdrawals } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const withdrawals = await listRecentWithdrawals();
    return NextResponse.json({ withdrawals });
  } catch (error) {
    return handleApiError(error);
  }
}
