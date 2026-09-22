import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { FlowDiagram } from "@/components/landing/FlowDiagram";

const steps = [
  {
    title: "Connect your wallet",
    body: "Click Connect Wallet and approve the connection in your Solana wallet (Phantom, Solflare, Backpack, or any Wallet Standard–compatible wallet). Your public wallet address becomes your YIELD identity — there is no email, password, or account form.",
  },
  {
    title: "Sign in without a password",
    body: "Your wallet signs a one-time message to prove you control the address. This never triggers a blockchain transaction and costs no gas — it just proves ownership so the backend can trust your session.",
  },
  {
    title: "Deposit to invest",
    body: "Choose an amount and confirm the transaction in your wallet. Funds move directly from your wallet to the platform's deposit address on Solana devnet.",
  },
  {
    title: "We verify on-chain, then credit your ledger",
    body: "The backend independently checks the transaction's destination, sender, amount, and finality on the Solana blockchain before crediting anything — your dashboard is never updated from a client-supplied number.",
  },
  {
    title: "Track performance daily",
    body: "Your position accrues against a target annualized rate, calculated with decimal-safe arithmetic. Watch portfolio value, today's earnings, and total earnings update in real time.",
  },
  {
    title: "Redeem when ready",
    body: "Request a redemption quote — the backend computes the authoritative value, including any early-redemption liquidity adjustment, and the quote expires after 5 minutes.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-5xl">How YIELD works</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
            Wallet-first from end to end. Here is exactly what happens between connecting your wallet and seeing your
            portfolio grow.
          </p>
        </section>

        <section className="border-y border-border bg-surface px-5 py-16">
          <FlowDiagram />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          <ol className="flex flex-col gap-10">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span className="font-tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-sm font-semibold text-ink">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-20 text-center">
          <p className="text-xs leading-relaxed text-ink-faint">
            Prototype. Investment figures shown are simulated and do not represent an offer of securities or a
            guarantee of returns.
          </p>
        </section>
      </main>
    </>
  );
}
