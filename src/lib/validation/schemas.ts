import { z } from "zod";

export const walletAddressSchema = z.string().min(32).max(48);

export const challengeRequestSchema = z.object({
  walletAddress: walletAddressSchema,
});

export const walletVerifySchema = z.object({
  walletAddress: walletAddressSchema,
  message: z.string().min(1),
  signature: z.string().min(1),
  challengeToken: z.string().min(1),
});

/** Amount fields arrive as decimal-string major units from the client (e.g. "100000.00") to avoid float transport. */
export const amountMajorUnitsSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

export const depositIntentSchema = z.object({
  amount: amountMajorUnitsSchema,
});

export const depositSubmitSchema = z.object({
  depositId: z.string().uuid(),
  transactionSignature: z.string().min(32),
});

export const depositVerifySchema = z.object({
  depositId: z.string().uuid(),
});

export const redemptionQuoteRequestSchema = z.object({
  positionId: z.string().uuid(),
});

export const redemptionConfirmSchema = z.object({
  quoteId: z.string().uuid(),
});

export const withdrawalRequestSchema = z.object({
  amount: amountMajorUnitsSchema,
  destinationWallet: walletAddressSchema,
});

export const adminProductUpdateSchema = z.object({
  productId: z.string().uuid(),
  targetAnnualRateBps: z.number().int().min(0).max(10_000).optional(),
  cycleDays: z.number().int().min(1).max(3650).optional(),
  status: z.enum(["active", "paused", "retired"]).optional(),
});

export const transactionsQuerySchema = z.object({
  type: z.enum(["deposit", "withdrawal", "earning", "redemption"]).optional(),
});
