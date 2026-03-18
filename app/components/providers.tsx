"use client";

import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";

import { autoDiscover, createClient } from "@solana/client";
import { ThemeProvider } from "./theme-provider";

const client = createClient({
  endpoint: "https://api.devnet.solana.com",
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <SolanaProvider client={client}>{children}</SolanaProvider>
    </ThemeProvider>
  );
}
