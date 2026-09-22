import { NextResponse } from "next/server";
import { challengeRequestSchema } from "@/lib/validation/schemas";
import { normalizeWalletAddress, buildChallengeMessage } from "@/lib/services/walletService";
import { signChallengeToken } from "@/lib/auth/jwt";
import { handleApiError } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`auth:challenge:${getClientIp(request)}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
        { status: 429 }
      );
    }

    const body = challengeRequestSchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(body.walletAddress);
    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const message = buildChallengeMessage({ walletAddress, nonce, issuedAt });
    const challengeToken = await signChallengeToken({ walletAddress, message });

    return NextResponse.json({ message, challengeToken });
  } catch (error) {
    return handleApiError(error);
  }
}
