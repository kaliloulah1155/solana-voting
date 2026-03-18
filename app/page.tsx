"use client";

import { useWalletConnection } from "@solana/react-hooks";
import { VotingCard } from "./components/voting-card";
import { ThemeSwitch } from "./components/theme-switch";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address?.toString();
  const shortAddress = address
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : null;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      {/* Top bar: logo + wallet */}
      <header className="sticky top-0 z-20 border-b border-border-low bg-bg1/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-bg1"
              aria-hidden
            >
              <span className="text-lg font-bold">V</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Voting Dapp
              </h1>
              <p className="text-xs text-muted">On-chain • Solana Devnet</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitch />
            {status === "connected" ? (
              <>
                <span className="hidden rounded-lg bg-cream/80 px-3 py-1.5 font-mono text-xs sm:inline-block">
                  {shortAddress}
                </span>
                <button
                  onClick={() => disconnect()}
                  className="rounded-lg border border-border-low bg-card px-3 py-2 text-sm font-medium transition hover:bg-cream/30"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => connect(connector.id)}
                    disabled={status === "connecting"}
                    className="rounded-lg border border-border-low bg-card px-4 py-2 text-sm font-medium transition hover:bg-cream/30 disabled:opacity-50"
                  >
                    {connector.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 lg:px-10">
        {/* Hero */}
        <section className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Deposit & withdraw SOL on-chain
          </h2>
          <p className="mt-2 max-w-xl mx-auto text-sm text-muted">
            Connect your wallet, then use your personal voting PDA to lock and
            unlock SOL on Solana devnet.
          </p>
        </section>

        {/* Main content: voting card */}
        <VotingCard />

        {/* Minimal footer */}
        <footer className="border-t border-border-low pt-6 text-center text-xs text-muted">
          <a
            href="https://faucet.solana.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground/80"
          >
            Devnet faucet
          </a>
          <span className="mx-2">•</span>
          <a
            href="https://www.anchor-lang.com/docs"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground/80"
          >
            Anchor
          </a>
        </footer>
      </main>
    </div>
  );
}
