import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/services/adminService";
import { InvalidWalletAddressError, InvalidSignatureError } from "@/lib/services/walletService";
import { DepositError } from "@/lib/services/depositService";
import { InsufficientBalanceError } from "@/lib/services/ledgerService";
import { InvalidDestinationError } from "@/lib/services/withdrawalService";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Central error-to-HTTP mapping so route handlers never leak stack traces or
 * raw Postgres/RPC errors to the client (see FINAL REQUIREMENT: friendly
 * errors only).
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return apiError(400, "validation_error", error.issues[0]?.message ?? "Invalid request");
  }
  if (error instanceof UnauthorizedError) {
    return apiError(401, "wallet_not_connected", "Please connect your wallet to continue.");
  }
  if (error instanceof ForbiddenError) {
    return apiError(403, "forbidden", error.message);
  }
  if (error instanceof InvalidWalletAddressError || error instanceof InvalidDestinationError) {
    return apiError(400, "invalid_wallet_address", error.message);
  }
  if (error instanceof InvalidSignatureError) {
    return apiError(401, "invalid_signature", error.message);
  }
  if (error instanceof InsufficientBalanceError) {
    return apiError(409, "insufficient_balance", "You do not have enough balance for this operation.");
  }
  if (error instanceof DepositError) {
    return apiError(409, error.code, error.message);
  }
  if (error instanceof Error) {
    if (error.message === "quote_expired") {
      return apiError(410, "quote_expired", "This redemption quote has expired. Please request a new one.");
    }
    if (error.message === "quote_already_used") {
      return apiError(409, "quote_already_used", "This redemption quote has already been used.");
    }
    if (error.message === "not_found") {
      return apiError(404, "not_found", "The requested resource was not found.");
    }
    if (error.message === "position_not_active") {
      return apiError(409, "position_not_active", "This investment is not active.");
    }
    if (error.message === "invalid_amount") {
      return apiError(400, "invalid_amount", "Enter a valid amount.");
    }
  }

  console.error("Unhandled API error:", error);
  return apiError(500, "internal_error", "Something went wrong. Please try again.");
}
