import { SignJWT } from "jose";
import type { BrowserContext } from "@playwright/test";

// Mirrors src/lib/auth/jwt.ts's signSessionToken. Reimplemented here (rather
// than imported) because that module pulls in the `server-only` package,
// which throws when loaded outside Next.js's own bundler — Playwright tests
// run in plain Node.
const SESSION_SECRET = "e2e-test-session-secret-do-not-use-in-prod";
const SESSION_COOKIE_NAME = "yield_session";

export async function signSessionToken(payload: { userId: string; walletAddress: string }): Promise<string> {
  const secretKey = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({ ...payload, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

/** Logs a browser context in as a wallet-holder without driving the real wallet-signature flow. */
export async function loginAs(
  context: BrowserContext,
  user: { userId: string; walletAddress: string },
  baseURL: string
): Promise<void> {
  const token = await signSessionToken(user);
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export const TEST_USER = {
  userId: "11111111-1111-4111-8111-111111111111",
  walletAddress: "11111111111111111111111111111111",
};

export const TEST_ADMIN = {
  userId: "22222222-2222-4222-8222-222222222222",
  walletAddress: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
};
