import type { Page } from "@playwright/test";

/**
 * Injects a minimal Wallet Standard–compliant wallet into the page before
 * any app code runs, so @solana/wallet-adapter-react's auto-detection picks
 * it up exactly like it would a real extension (Phantom, Solflare, …).
 *
 * The signature bytes returned by signMessage/signAndSendTransaction are not
 * cryptographically real — that's covered by walletService's unit tests.
 * Here we only need the *shape* to satisfy the wallet-adapter's expectations
 * so the UI flow (connect → sign-in → dashboard, and deposit → sign → submit)
 * can be driven end-to-end against mocked backend/RPC responses.
 */
export async function installFakeWallet(page: Page, address: string): Promise<void> {
  await page.addInitScript((walletAddress: string) => {
    function base58Decode(_s: string): number[] {
      // Not needed by the app (it only ever base58-*encodes* our address),
      // but kept as a stub for completeness of the account shape.
      return [];
    }
    void base58Decode;

    const ICON =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    // Minimal base58 encoder (Bitcoin alphabet) so the injected script has
    // no external dependencies — only used to build the fake public key.
    function base58Encode(bytes: Uint8Array): string {
      const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      const digits = [0];
      for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i]!;
        for (let j = 0; j < digits.length; j++) {
          carry += digits[j]! << 8;
          digits[j] = carry % 58;
          carry = (carry / 58) | 0;
        }
        while (carry > 0) {
          digits.push(carry % 58);
          carry = (carry / 58) | 0;
        }
      }
      let result = "";
      for (let k = 0; bytes[k] === 0 && k < bytes.length - 1; k++) result += "1";
      for (let q = digits.length - 1; q >= 0; q--) result += ALPHABET[digits[q]!];
      return result;
    }
    void base58Encode;

    const fakeSignature = new Uint8Array(64).fill(9);

    const account = {
      address: walletAddress,
      publicKey: new Uint8Array(32).fill(1),
      chains: ["solana:devnet"],
      features: ["solana:signMessage", "solana:signAndSendTransaction", "solana:signTransaction"],
      label: "E2E Fake Wallet",
      icon: ICON,
    };

    const listeners = new Set<(...args: unknown[]) => void>();

    const wallet = {
      version: "1.0.0",
      name: "E2E Fake Wallet",
      icon: ICON,
      chains: ["solana:devnet"],
      accounts: [account],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [account] }),
        },
        "standard:disconnect": {
          version: "1.0.0",
          disconnect: async () => {},
        },
        "standard:events": {
          version: "1.0.0",
          on: (event: string, listener: (...args: unknown[]) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
        "solana:signMessage": {
          version: "1.0.0",
          signMessage: async (...inputs: { message: Uint8Array }[]) =>
            inputs.map((input) => ({ signedMessage: input.message, signature: fakeSignature })),
        },
        "solana:signAndSendTransaction": {
          version: "1.0.0",
          // Required by StandardWalletAdapter's constructor (it reads this
          // synchronously to compute supportedTransactionVersions) — omitting
          // it throws "Cannot read properties of undefined" during wallet
          // detection and silently breaks the whole page's hydration.
          supportedTransactionVersions: ["legacy"],
          signAndSendTransaction: async (..._inputs: unknown[]) => [{ signature: fakeSignature }],
        },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy"],
          signTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
            inputs.map((input) => ({ signedTransaction: input.transaction })),
        },
      },
    };

    function registerWallet() {
      const callback = (api: { register: (w: unknown) => void }) => api.register(wallet);
      try {
        window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: callback }));
      } catch {
        // ignore
      }
      window.addEventListener("wallet-standard:app-ready", ((event: CustomEvent) => {
        callback(event.detail);
      }) as EventListener);
    }

    registerWallet();
  }, address);
}
