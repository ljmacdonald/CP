import { bigIntCeilDiv, bigIntFloorDiv, type MinorUnits } from "@/lib/money";

const DAYS_IN_YEAR = 365n;
const BPS_DENOMINATOR = 10_000n;

export interface AccrualInput {
  principal: MinorUnits;
  startDate: Date;
  currentDate: Date;
  maturityDate: Date;
  annualRateBps: number; // basis points, e.g. 2500 = 25.00%
}

export interface AccrualResult {
  elapsedDays: number;
  remainingDays: number;
  accruedReturn: MinorUnits;
  currentValue: MinorUnits;
  estimatedMaturityValue: MinorUnits;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * principal * annualRateBps * days / (10_000 * 365), floored to whole minor
 * units. Every operand is an integer, so this is computed as an exact BigInt
 * ratio rather than through a decimal library — there is no repeating-decimal
 * rounding to guard against, and it can never over-credit a user.
 */
function accrualAmount(principal: MinorUnits, annualRateBps: number, days: number): MinorUnits {
  if (days <= 0) return 0n;
  const numerator = principal * BigInt(annualRateBps) * BigInt(days);
  const denominator = BPS_DENOMINATOR * DAYS_IN_YEAR;
  return bigIntFloorDiv(numerator, denominator);
}

/**
 * Simple daily-compounding-free accrual: annual_rate / 365 applied per elapsed
 * day against the original principal. Deliberately not compounded so the
 * prototype's numbers stay easy to audit; a production engine could swap in
 * compounding without changing this function's signature or callers.
 */
export function calculateAccrual(input: AccrualInput): AccrualResult {
  const { principal, startDate, currentDate, maturityDate, annualRateBps } = input;

  const totalCycleDays = Math.max(daysBetween(startDate, maturityDate), 1);
  const rawElapsed = daysBetween(startDate, currentDate);
  const elapsedDays = Math.min(Math.max(rawElapsed, 0), totalCycleDays);
  const remainingDays = Math.max(totalCycleDays - elapsedDays, 0);

  const accruedReturn = accrualAmount(principal, annualRateBps, elapsedDays);
  const currentValue = principal + accruedReturn;
  const estimatedMaturityValue = principal + accrualAmount(principal, annualRateBps, totalCycleDays);

  return { elapsedDays, remainingDays, accruedReturn, currentValue, estimatedMaturityValue };
}

export interface ProjectionInput {
  principal: MinorUnits;
  annualRateBps: number;
  cycleDays: number;
}

export interface ProjectionResult {
  estimatedEarnings: MinorUnits;
  estimatedMaturityValue: MinorUnits;
  dailyRateBps: number;
}

/** Used by the deposit flow's "before you sign" preview — no DB round trip needed. */
export function projectInvestment(input: ProjectionInput): ProjectionResult {
  const { principal, annualRateBps, cycleDays } = input;
  const estimatedEarnings = accrualAmount(principal, annualRateBps, cycleDays);
  return {
    estimatedEarnings,
    estimatedMaturityValue: principal + estimatedEarnings,
    dailyRateBps: annualRateBps / Number(DAYS_IN_YEAR),
  };
}

export interface RedemptionInput {
  currentValue: MinorUnits;
  elapsedDays: number;
  totalCycleDays: number;
  /** Basis points of currentValue withheld for early redemption, 0 if matured. */
  earlyRedemptionPenaltyBps: number;
}

export interface RedemptionResult {
  currentValue: MinorUnits;
  liquidityAdjustment: MinorUnits;
  redemptionValue: MinorUnits;
  isEarly: boolean;
}

export function calculateRedemption(input: RedemptionInput): RedemptionResult {
  const { currentValue, elapsedDays, totalCycleDays, earlyRedemptionPenaltyBps } = input;
  const isEarly = elapsedDays < totalCycleDays;

  if (!isEarly) {
    return { currentValue, liquidityAdjustment: 0n, redemptionValue: currentValue, isEarly: false };
  }

  // Ceiling, not floor: the adjustment withheld should never be rounded in
  // the user's favor.
  const liquidityAdjustment = bigIntCeilDiv(currentValue * BigInt(earlyRedemptionPenaltyBps), BPS_DENOMINATOR);
  const redemptionValue = currentValue - liquidityAdjustment;

  return {
    currentValue,
    liquidityAdjustment,
    redemptionValue: redemptionValue < 0n ? 0n : redemptionValue,
    isEarly: true,
  };
}
