import "../unit/setup";
import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  normalizeWalletAddress,
  verifyWalletSignature,
  buildChallengeMessage,
  InvalidWalletAddressError,
} from "@/lib/services/walletService";

describe("walletService — wallet connection", () => {
  describe("normalizeWalletAddress", () => {
    it("accepts a valid base58 Solana address", () => {
      const keypair = nacl.sign.keyPair();
      const address = bs58.encode(keypair.publicKey);
      expect(normalizeWalletAddress(address)).toBe(address);
    });

    it("trims surrounding whitespace", () => {
      const keypair = nacl.sign.keyPair();
      const address = bs58.encode(keypair.publicKey);
      expect(normalizeWalletAddress(`  ${address}  `)).toBe(address);
    });

    it("rejects an address with invalid base58 characters", () => {
      expect(() => normalizeWalletAddress("not-a-valid-wallet-0OIl")).toThrow(InvalidWalletAddressError);
    });

    it("rejects a string that is not 32 bytes when decoded", () => {
      expect(() => normalizeWalletAddress("abc")).toThrow(InvalidWalletAddressError);
    });

    it("rejects an empty string", () => {
      expect(() => normalizeWalletAddress("")).toThrow(InvalidWalletAddressError);
    });
  });

  describe("verifyWalletSignature (sign-in-with-solana)", () => {
    it("verifies a genuine signature from the wallet's own keypair", () => {
      const keypair = nacl.sign.keyPair();
      const walletAddress = bs58.encode(keypair.publicKey);
      const message = buildChallengeMessage({
        walletAddress,
        nonce: "test-nonce",
        issuedAt: new Date().toISOString(),
      });

      const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      expect(verifyWalletSignature({ walletAddress, message, signature })).toBe(true);
    });

    it("rejects a signature produced by a different wallet (impersonation attempt)", () => {
      const realKeypair = nacl.sign.keyPair();
      const attackerKeypair = nacl.sign.keyPair();
      const claimedWalletAddress = bs58.encode(realKeypair.publicKey);
      const message = buildChallengeMessage({
        walletAddress: claimedWalletAddress,
        nonce: "test-nonce",
        issuedAt: new Date().toISOString(),
      });

      // Attacker signs with their own key but claims to be `claimedWalletAddress`.
      const forgedSignature = bs58.encode(
        nacl.sign.detached(new TextEncoder().encode(message), attackerKeypair.secretKey)
      );

      expect(
        verifyWalletSignature({ walletAddress: claimedWalletAddress, message, signature: forgedSignature })
      ).toBe(false);
    });

    it("rejects a signature over a tampered message", () => {
      const keypair = nacl.sign.keyPair();
      const walletAddress = bs58.encode(keypair.publicKey);
      const message = buildChallengeMessage({ walletAddress, nonce: "n1", issuedAt: new Date().toISOString() });
      const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey));

      const tamperedMessage = message.replace("n1", "n2");

      expect(verifyWalletSignature({ walletAddress, message: tamperedMessage, signature })).toBe(false);
    });

    it("returns false rather than throwing on garbage input", () => {
      expect(
        verifyWalletSignature({ walletAddress: "not-base58!!", message: "hi", signature: "also-not-base58!!" })
      ).toBe(false);
    });
  });
});
