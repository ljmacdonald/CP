import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { FlowDiagram } from "@/components/landing/FlowDiagram";
import { RedirectIfAuthenticated } from "@/components/landing/RedirectIfAuthenticated";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { LinkButton } from "@/components/ui/Button";

export default function Home() {
  return (
    <>
      <RedirectIfAuthenticated />
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-5 pb-16 pt-20 text-center sm:pb-24 sm:pt-28">
          <h1 className="animate-fade-up text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Put your money to work.
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-balance text-base leading-relaxed text-ink-muted sm:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            A simple wallet-first platform for tracking your investment position, earnings and redemption value.
          </p>
          <div
            className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "160ms" }}
          >
            <ConnectWalletButton className="px-7 py-3.5 text-base" />
            <LinkButton href="/how-it-works" variant="secondary" size="lg">
              How it works
            </LinkButton>
          </div>
        </section>

        {/* Headline stats */}
        <section id="returns" className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <HeroStat value="25%" label="Target annualized return*" />
            <HeroStat value="6 months" label="Investment cycle" />
            <HeroStat value="Daily" label="Portfolio valuation" />
          </div>
        </section>

        {/* Flow explainer */}
        <section className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-faint">How it works</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Your capital, always visible.
          </p>
          <div className="mt-14">
            <FlowDiagram />
          </div>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
            <ExplainerStep
              n="01"
              title="Connect your wallet"
              body="Your Solana wallet is your identity. No email, no password, no forms."
            />
            <ExplainerStep
              n="02"
              title="Deposit to invest"
              body="Send USDC from your wallet. We verify the transaction on-chain before crediting anything."
            />
            <ExplainerStep
              n="03"
              title="Track and redeem"
              body="Watch your position accrue daily, then request redemption whenever you're ready."
            />
          </div>
        </section>

        {/* Proof, not promises */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
            <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-faint">
              Proof, not promises
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Don&apos;t trust the numbers. Check them.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink-muted">
              Everything below is something you can verify yourself, right now, not a claim you have to take on
              faith.
            </p>
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
              <ProofPoint
                title="Every deposit is re-checked on-chain"
                body="The backend never trusts what your browser sends it — it independently re-reads your transaction from Solana devnet (destination, sender, amount, success) before crediting anything."
              />
              <ProofPoint
                title="Every transaction has a receipt"
                body="Deposits, accruals, redemptions and withdrawals all show up on your Transactions page, each linked to a real signature you can open directly on Solana Explorer."
              />
              <ProofPoint
                title="Admin actions are logged, not silent"
                body="Every product change, deposit decision, redemption and withdrawal an admin touches is written to an audit trail with who, what changed, and when."
              />
              <ProofPoint
                title="Math you can re-derive by hand"
                body="Returns are computed as exact integer ratios, not floating-point approximations — the same arithmetic the backend uses to credit your balance is documented in the source."
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
            <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-faint">FAQ</h2>
            <div className="mt-10 divide-y divide-border">
              <FaqItem
                q="Is the 25% return guaranteed?"
                a="No. The target annualized return is a goal, not a guarantee. This prototype simulates performance for demonstration purposes."
              />
              <FaqItem
                q="What happens to my private keys?"
                a="Nothing — YIELD never asks for your seed phrase or private key. You approve every transaction in your own wallet."
              />
              <FaqItem
                q="Can I withdraw early?"
                a="Yes, subject to a liquidity adjustment for redemptions requested before the investment cycle matures."
              />
              <FaqItem
                q="What network does this run on?"
                a="This prototype runs on Solana devnet. No real funds are used."
              />
              <FaqItem
                q="Should I trust this with real money?"
                a="No — this is a working prototype, not a live financial product. It exists to demonstrate how a wallet-first investment platform's verification, accrual and audit mechanics can be built end-to-end, on devnet only."
              />
              <FaqItem
                q="I don't trust it yet. What should I do?"
                a="Start with the smallest deposit you can make, then watch the whole cycle: your transaction confirm on-chain, your dashboard update, and the entry appear in your transaction history. Only then decide whether the rest holds up."
              />
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mx-auto max-w-3xl px-5 py-14 text-center">
          <p className="text-xs leading-relaxed text-ink-faint">
            Prototype. Investment figures shown are simulated and do not represent an offer of securities or a
            guarantee of returns.
          </p>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-8 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} YIELD. Built on Solana devnet.
      </footer>
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <span className="font-tabular text-3xl font-semibold text-ink sm:text-4xl">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  );
}

function ExplainerStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="text-left">
      <span className="font-tabular text-xs font-semibold text-accent">{n}</span>
      <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function ProofPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-6 text-left">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
        {q}
        <span className="ml-4 shrink-0 text-ink-faint transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{a}</p>
    </details>
  );
}
