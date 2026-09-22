import { describe, expect, it } from "vitest";
import {
  calculateAccrual,
  calculateRedemption,
  projectInvestment,
} from "@/lib/services/financialCalculationService";

describe("financialCalculationService", () => {
  describe("calculateAccrual (daily accrual)", () => {
    it("accrues zero on day zero", () => {
      const start = new Date("2025-01-01T00:00:00Z");
      const result = calculateAccrual({
        principal: 10_000_00n, // ₦10,000.00
        startDate: start,
        currentDate: start,
        maturityDate: new Date("2025-06-30T00:00:00Z"),
        annualRateBps: 2500, // 25%
      });

      expect(result.elapsedDays).toBe(0);
      expect(result.accruedReturn).toBe(0n);
      expect(result.currentValue).toBe(10_000_00n);
    });

    it("accrues principal * annualRate/365 per elapsed day", () => {
      const start = new Date("2025-01-01T00:00:00Z");
      const oneDayLater = new Date("2025-01-02T00:00:00Z");
      const result = calculateAccrual({
        principal: 365_00n, // ₦365.00 chosen so daily accrual is a whole minor unit
        startDate: start,
        currentDate: oneDayLater,
        maturityDate: new Date("2025-07-01T00:00:00Z"),
        annualRateBps: 10_000, // 100% annual, so daily = principal/365
      });

      expect(result.elapsedDays).toBe(1);
      expect(result.accruedReturn).toBe(1_00n); // ₦1.00
      expect(result.currentValue).toBe(366_00n);
    });

    it("never accrues past the maturity date even if currentDate is later", () => {
      const start = new Date("2025-01-01T00:00:00Z");
      const maturity = new Date("2025-01-31T00:00:00Z"); // 30-day cycle
      const wellAfterMaturity = new Date("2025-06-01T00:00:00Z");

      const atMaturity = calculateAccrual({
        principal: 100_000_00n,
        startDate: start,
        currentDate: maturity,
        maturityDate: maturity,
        annualRateBps: 2500,
      });
      const afterMaturity = calculateAccrual({
        principal: 100_000_00n,
        startDate: start,
        currentDate: wellAfterMaturity,
        maturityDate: maturity,
        annualRateBps: 2500,
      });

      expect(afterMaturity.elapsedDays).toBe(atMaturity.elapsedDays);
      expect(afterMaturity.currentValue).toBe(atMaturity.currentValue);
      expect(afterMaturity.remainingDays).toBe(0);
    });

    it("computes the correct maturity value for a full cycle (maturity calculation)", () => {
      const start = new Date("2025-01-01T00:00:00Z");
      const maturity = new Date("2025-07-01T00:00:00Z"); // 181 days
      const result = calculateAccrual({
        principal: 1_000_000_00n, // ₦1,000,000.00
        startDate: start,
        currentDate: maturity,
        maturityDate: maturity,
        annualRateBps: 2500,
      });

      const cycleDays = Math.round((maturity.getTime() - start.getTime()) / 86_400_000);
      const expectedReturn = (1_000_000_00n * 2500n * BigInt(cycleDays)) / 10_000n / 365n;

      expect(result.currentValue).toBe(1_000_000_00n + expectedReturn);
      expect(result.estimatedMaturityValue).toBe(result.currentValue);
      expect(result.remainingDays).toBe(0);
    });

    it("never returns a negative accrued amount or current value below principal", () => {
      const start = new Date("2025-01-01T00:00:00Z");
      const result = calculateAccrual({
        principal: 500_00n,
        startDate: start,
        currentDate: new Date("2024-01-01T00:00:00Z"), // before start
        maturityDate: new Date("2025-07-01T00:00:00Z"),
        annualRateBps: 2500,
      });

      expect(result.elapsedDays).toBe(0);
      expect(result.accruedReturn).toBe(0n);
      expect(result.currentValue).toBe(500_00n);
    });
  });

  describe("projectInvestment", () => {
    it("projects estimated earnings and maturity value for a deposit preview", () => {
      const result = projectInvestment({
        principal: 100_000_00n,
        annualRateBps: 2500,
        cycleDays: 180,
      });

      const expectedEarnings = (100_000_00n * 2500n * 180n) / 10_000n / 365n;
      expect(result.estimatedEarnings).toBe(expectedEarnings);
      expect(result.estimatedMaturityValue).toBe(100_000_00n + expectedEarnings);
    });
  });

  describe("calculateRedemption", () => {
    it("applies no liquidity adjustment once the cycle has fully matured", () => {
      const result = calculateRedemption({
        currentValue: 120_000_00n,
        elapsedDays: 180,
        totalCycleDays: 180,
        earlyRedemptionPenaltyBps: 500,
      });

      expect(result.isEarly).toBe(false);
      expect(result.liquidityAdjustment).toBe(0n);
      expect(result.redemptionValue).toBe(120_000_00n);
    });

    it("applies the liquidity adjustment for an early redemption", () => {
      const result = calculateRedemption({
        currentValue: 110_000_00n,
        elapsedDays: 90,
        totalCycleDays: 180,
        earlyRedemptionPenaltyBps: 500, // 5%
      });

      expect(result.isEarly).toBe(true);
      expect(result.liquidityAdjustment).toBe(5_500_00n); // 5% of 110,000
      expect(result.redemptionValue).toBe(104_500_00n);
    });

    it("never lets the redemption value go negative", () => {
      const result = calculateRedemption({
        currentValue: 10n,
        elapsedDays: 1,
        totalCycleDays: 180,
        earlyRedemptionPenaltyBps: 10_000, // 100% — pathological config
      });

      expect(result.redemptionValue).toBe(0n);
    });
  });
});
