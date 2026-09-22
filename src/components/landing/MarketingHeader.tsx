import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          YIELD
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted md:flex">
          <Link href="/how-it-works" className="transition hover:text-ink">
            How it works
          </Link>
          <Link href="/#returns" className="transition hover:text-ink">
            Returns
          </Link>
          <Link href="/#faq" className="transition hover:text-ink">
            FAQ
          </Link>
        </nav>
        <ConnectWalletButton />
      </div>
    </header>
  );
}
