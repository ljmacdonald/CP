import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { getAdminMetrics } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const metrics = await getAdminMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return handleApiError(error);
  }
}
