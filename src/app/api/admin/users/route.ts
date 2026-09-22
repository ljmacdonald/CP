import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api/admin";
import { listRecentUsers } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAdminSession();
    const users = await listRecentUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
