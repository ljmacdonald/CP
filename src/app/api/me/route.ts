import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isAdminWallet } from "@/lib/services/adminService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      userId: session.userId,
      walletAddress: session.walletAddress,
      isAdmin: isAdminWallet(session.walletAddress),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
