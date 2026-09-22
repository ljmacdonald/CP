import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { runDailyAccrualForAllActivePositions } from "@/lib/services/accrualService";
import { recordAuditLog } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

/**
 * Manually triggers the daily accrual snapshot job. In production this route
 * would instead be invoked by a scheduler (cron / Supabase Edge Function on a
 * schedule); it is exposed here, admin-gated, so the prototype can be
 * exercised without external infrastructure.
 */
export async function POST() {
  try {
    const session = await requireAdminSession();
    const rowsWritten = await runDailyAccrualForAllActivePositions();
    await recordAuditLog({
      actorType: "admin",
      actorId: session.walletAddress,
      action: "accruals.run",
      entityType: "daily_accruals",
      metadata: { rowsWritten },
    });
    return NextResponse.json({ rowsWritten });
  } catch (error) {
    return handleApiError(error);
  }
}
