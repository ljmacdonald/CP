import "server-only";
import { requireSession } from "@/lib/auth/session";
import { requireAdminWallet } from "@/lib/services/adminService";
import type { SessionPayload } from "@/lib/auth/jwt";

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await requireSession();
  requireAdminWallet(session.walletAddress);
  return session;
}
