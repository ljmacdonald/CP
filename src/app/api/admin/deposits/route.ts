import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { listRecentDeposits } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const deposits = await listRecentDeposits();
    return NextResponse.json({ deposits });
  } catch (error) {
    return handleApiError(error);
  }
}
