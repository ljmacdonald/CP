import { NextResponse } from "next/server";
import { walletVerifySchema } from "@/lib/validation/schemas";
import { normalizeWalletAddress, verifyWalletSignature, getOrCreateUserByWallet, InvalidSignatureError } from "@/lib/services/walletService";
import { verifyChallengeToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`auth:verify:${getClientIp(request)}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
        { status: 429 }
      );
    }

    const body = walletVerifySchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(body.walletAddress);

    const challenge = await verifyChallengeToken(body.challengeToken).catch(() => null);
    if (!challenge || challenge.walletAddress !== walletAddress || challenge.message !== body.message) {
      throw new InvalidSignatureError();
    }

    const isValid = verifyWalletSignature({
      walletAddress,
      message: body.message,
      signature: body.signature,
    });
    if (!isValid) {
      throw new InvalidSignatureError();
    }

    const user = await getOrCreateUserByWallet(walletAddress);
    await createSession({ userId: user.id, walletAddress: user.wallet_address });

    return NextResponse.json({ userId: user.id, walletAddress: user.wallet_address });
  } catch (error) {
    return handleApiError(error);
  }
}
