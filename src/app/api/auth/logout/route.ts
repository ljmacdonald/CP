import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/response";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
