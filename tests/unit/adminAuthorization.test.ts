import "../unit/setup";
import { describe, expect, it } from "vitest";
import { TEST_ADMIN_WALLET, TEST_USER_WALLET } from "./setup";
import { isAdminWallet, requireAdminWallet, ForbiddenError } from "@/lib/services/adminService";

describe("adminService — admin authorization", () => {
  it("recognizes a wallet on the ADMIN_WALLET_ADDRESSES allowlist", () => {
    expect(isAdminWallet(TEST_ADMIN_WALLET)).toBe(true);
  });

  it("rejects a wallet that is not on the allowlist", () => {
    expect(isAdminWallet(TEST_USER_WALLET)).toBe(false);
  });

  it("requireAdminWallet passes silently for an allowlisted wallet", () => {
    expect(() => requireAdminWallet(TEST_ADMIN_WALLET)).not.toThrow();
  });

  it("requireAdminWallet throws ForbiddenError for a non-admin wallet", () => {
    expect(() => requireAdminWallet(TEST_USER_WALLET)).toThrow(ForbiddenError);
  });

  it("does not merely check that the wallet is truthy — an unrelated valid address is still rejected", () => {
    expect(isAdminWallet("11111111111111111111111111111111")).toBe(false);
  });
});
