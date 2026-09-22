import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listPositions } from "@/lib/services/investmentService";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireSession();
    const positions = await listPositions(session.userId);
    return NextResponse.json({ positions });
  } catch (error) {
    return handleApiError(error);
  }
}
