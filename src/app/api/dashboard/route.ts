import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/services/dashboardService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireSession();
    const snapshot = await getDashboardSnapshot(session.userId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
