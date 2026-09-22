/**
 * All money in this codebase is represented as BIGINT "minor units" (2 decimal
 * places, e.g. kobo/cents). Never use `number`/float for balances, principal,
 * or accrual math. Rate math (financialCalculationService,
 * transactionVerificationService, depositService) is done as exact BigInt
 * ratios via bigIntFloorDiv/bigIntCeilDiv below rather than a decimal
 * library, since every quantity involved (principal, basis points, day
 * counts, lamports) is already an integer — a ratio of integers has an exact
 * floor/ceiling with no repeating-decimal rounding to worry about.
 */
export type MinorUnits = bigint;

/** Floor division for non-negative BigInt operands (a, b > 0). */
export function bigIntFloorDiv(numerator: bigint, denominator: bigint): bigint {
  return numerator / denominator;
}

/** Ceiling division for non-negative BigInt operands (a, b > 0). */
export function bigIntCeilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export const MINOR_UNITS_PER_MAJOR = 100n;

export function toMinorUnits(majorAmount: number | string): MinorUnits {
  const decimal = String(majorAmount);
  const [whole, fraction = ""] = decimal.split(".");
  const paddedFraction = (fraction + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeAbs = whole.replace("-", "") || "0";
  return sign * (BigInt(wholeAbs) * MINOR_UNITS_PER_MAJOR + BigInt(paddedFraction || "0"));
}

/**
 * bigint does not survive JSON.stringify. API responses send minor-unit
 * amounts as decimal strings; this accepts either so the same formatter
 * works server-side (bigint) and client-side (string from fetch()).
 */
export function formatMinorUnits(amount: MinorUnits | string, currencySymbol = "₦"): string {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  return formatMinorUnitsBigint(value, currencySymbol);
}

function formatMinorUnitsBigint(amount: MinorUnits, currencySymbol = "₦"): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / MINOR_UNITS_PER_MAJOR;
  const fraction = abs % MINOR_UNITS_PER_MAJOR;
  const wholeFormatted = whole.toLocaleString("en-US");
  const fractionFormatted = fraction.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${currencySymbol}${wholeFormatted}.${fractionFormatted}`;
}

export function minorUnitsToMajorNumber(amount: MinorUnits): number {
  return Number(amount) / 100;
}

export function isNonNegative(amount: MinorUnits): boolean {
  return amount >= 0n;
}
