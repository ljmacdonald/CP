import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { clientEnv } from "@/lib/env.client";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YIELD — Put your money to work",
  description:
    "A simple wallet-first platform for tracking your investment position, earnings and redemption value on Solana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <Providers>{children}</Providers>
        {clientEnv.solanaNetwork !== "mainnet-beta" && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border-strong bg-surface/95 px-3 py-1.5 text-[11px] font-medium tracking-wide text-ink-muted shadow-lg backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
              {clientEnv.solanaNetwork.toUpperCase()} MODE
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
