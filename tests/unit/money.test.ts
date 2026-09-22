import { describe, expect, it } from "vitest";
import { toMinorUnits, formatMinorUnits } from "@/lib/money";

describe("money", () => {
  describe("toMinorUnits", () => {
    it("converts a whole-number major amount", () => {
      expect(toMinorUnits("100000")).toBe(10_000_000n);
    });

    it("converts a decimal major amount without floating point drift", () => {
      // 0.1 + 0.2 famously != 0.3 in IEEE754 — this must stay exact.
      expect(toMinorUnits("0.10")).toBe(10n);
      expect(toMinorUnits("0.20")).toBe(20n);
      expect(toMinorUnits("0.30")).toBe(30n);
    });

    it("pads a single decimal digit", () => {
      expect(toMinorUnits("1.5")).toBe(150n);
    });

    it("handles large amounts exactly", () => {
      expect(toMinorUnits("999999999999.99")).toBe(99999999999999n);
    });
  });

  describe("formatMinorUnits", () => {
    it("formats a bigint amount with the naira symbol and thousands separators", () => {
      expect(formatMinorUnits(10_000_000n)).toBe("₦100,000.00");
    });

    it("formats a decimal-string amount (as returned by the API over JSON)", () => {
      expect(formatMinorUnits("150000")).toBe("₦1,500.00");
    });

    it("formats zero correctly", () => {
      expect(formatMinorUnits(0n)).toBe("₦0.00");
    });

    it("round-trips with toMinorUnits", () => {
      const minor = toMinorUnits("42.07");
      expect(formatMinorUnits(minor)).toBe("₦42.07");
    });
  });
});
