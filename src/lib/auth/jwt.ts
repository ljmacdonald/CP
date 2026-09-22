import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getServerEnv } from "@/lib/env";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

export interface ChallengePayload {
  walletAddress: string;
  message: string;
}

const CHALLENGE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Stateless sign-in challenge: server issues, client's wallet signs the embedded message, server verifies both the JWT and the wallet signature. */
export async function signChallengeToken(payload: ChallengePayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyChallengeToken(token: string): Promise<ChallengePayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  if (payload.typ !== "challenge" || typeof payload.walletAddress !== "string" || typeof payload.message !== "string") {
    throw new Error("Invalid challenge token");
  }
  return { walletAddress: payload.walletAddress, message: payload.message };
}

export interface SessionPayload {
  userId: string;
  walletAddress: string;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  if (payload.typ !== "session" || typeof payload.userId !== "string" || typeof payload.walletAddress !== "string") {
    throw new Error("Invalid session token");
  }
  return { userId: payload.userId, walletAddress: payload.walletAddress };
}

export const SESSION_COOKIE_NAME = "yield_session";
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
