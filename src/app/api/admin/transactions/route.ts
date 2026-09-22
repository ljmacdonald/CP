import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { listRecentTransactions } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const transactions = await listRecentTransactions();
    return NextResponse.json({ transactions });
  } catch (error) {
    return handleApiError(error);
  }
}
