"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useWalletConnection,
  useWalletSession,
  useSendTransaction,
  useBalance,
} from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  type Address,
} from "@solana/kit";
import {
  getDepositInstructionAsync,
  getWithdrawInstructionAsync,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";

const LAMPORTS_PER_SOL = 1_000_000_000n;
/** Minimum lamports for vault (program requires amount > rent exemption for 0-byte account) */
const MIN_DEPOSIT_LAMPORTS = 890_881n;
const MIN_DEPOSIT_SOL = Number(MIN_DEPOSIT_LAMPORTS) / Number(LAMPORTS_PER_SOL);

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();

  const [amount, setAmount] = useState("");
  const [vaultAddress, setVaultAddress] = useState<Address | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;

  // Derive vault PDA when wallet connects
  useEffect(() => {
    async function deriveVault() {
      if (!walletAddress) {
        setVaultAddress(null);
        return;
      }

      const [pda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
          getAddressEncoder().encode(walletAddress),
        ],
      });

      setVaultAddress(pda);
    }

    deriveVault();
  }, [walletAddress]);

  // Get vault balance
  const vaultBalance = useBalance(vaultAddress ?? undefined);
  const vaultLamports = vaultBalance?.lamports ?? 0n;
  const vaultSol = Number(vaultLamports) / Number(LAMPORTS_PER_SOL);

  const handleDeposit = useCallback(async () => {
    if (!session || !vaultAddress || !amount) return;

    const depositAmount = BigInt(
      Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
    );

    if (depositAmount < MIN_DEPOSIT_LAMPORTS) {
      setTxStatus(
        `Minimum deposit is ${MIN_DEPOSIT_SOL.toFixed(6)} SOL (rent exemption).`
      );
      return;
    }

    try {
      setTxStatus("Building transaction...");

      const { signer } = createWalletTransactionSigner(session);
      const instruction = await getDepositInstructionAsync({
        signer,
        vault: vaultAddress,
        amount: depositAmount,
      });

      setTxStatus("Awaiting signature...");

      const signature = await send({
        instructions: [instruction],
        authority: signer,
        feePayer: signer.address,
      });

      setTxStatus(`Deposited! Signature: ${signature?.slice(0, 20)}...`);
      setAmount("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as any).message)
            : "Unknown error";

      if (/reject|cancel/i.test(message)) {
        setTxStatus("Deposit cancelled by user.");
        return;
      }

      console.error("Deposit failed:", err);
      const cause =
        typeof err === "object" &&
        err !== null &&
        "context" in err &&
        typeof (err as any).context?.cause === "object"
          ? String((err as any).context.cause?.message ?? (err as any).context.cause)
          : null;
      setTxStatus(
        cause ? `Error: ${message}. ${cause}` : `Error: ${message}`
      );
    }
  }, [session, vaultAddress, amount, send]);

  const handleWithdraw = useCallback(async () => {
    if (!session || !vaultAddress) return;

    try {
      setTxStatus("Building transaction...");

      const { signer } = createWalletTransactionSigner(session);
      const instruction = await getWithdrawInstructionAsync({
        signer,
        vault: vaultAddress,
      });

      setTxStatus("Awaiting signature...");

      const signature = await send({
        instructions: [instruction],
        authority: signer,
        feePayer: signer.address,
      });

      setTxStatus(`Withdrawn! Signature: ${signature?.slice(0, 20)}...`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as any).message)
            : "Unknown error";

      if (/reject|cancel/i.test(message)) {
        setTxStatus("Withdraw cancelled by user.");
        return;
      }

      console.error("Withdraw failed:", err);
      const cause =
        typeof err === "object" &&
        err !== null &&
        "context" in err &&
        typeof (err as any).context?.cause === "object"
          ? String((err as any).context.cause?.message ?? (err as any).context.cause)
          : null;
      setTxStatus(
        cause ? `Error: ${message}. ${cause}` : `Error: ${message}`
      );
    }
  }, [session, vaultAddress, send]);

  if (status !== "connected") {
    return (
      <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
        <div className="space-y-1">
          <p className="text-lg font-semibold">SOL Vault</p>
          <p className="text-sm text-muted">
            Connect your wallet to interact with the vault program.
          </p>
        </div>
        <div className="rounded-lg bg-cream/50 p-4 text-center text-sm text-muted">
          Wallet not connected
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">SOL Vault</p>
          <p className="text-sm text-muted">
            Deposit SOL into your personal vault PDA and withdraw anytime.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
          {vaultLamports > 0n ? "Has funds" : "Empty"}
        </span>
      </div>

      {/* Vault Balance */}
      <div className="rounded-xl border border-border-low bg-cream/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          Vault Balance
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {vaultSol.toFixed(4)}{" "}
          <span className="text-lg font-normal text-muted">SOL</span>
        </p>
        {vaultAddress && (
          <p className="mt-2 truncate font-mono text-xs text-muted">
            {vaultAddress}
          </p>
        )}
      </div>

      {/* Deposit Form */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <input
            type="number"
            min={MIN_DEPOSIT_SOL}
            step="0.001"
            placeholder={`Min ${MIN_DEPOSIT_SOL.toFixed(4)} SOL`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSending}
            className="flex-1 rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleDeposit}
            disabled={
              isSending ||
              !amount ||
              parseFloat(amount) <= 0 ||
              BigInt(Math.floor((parseFloat(amount) || 0) * Number(LAMPORTS_PER_SOL))) <
                MIN_DEPOSIT_LAMPORTS ||
              vaultLamports > 0n
            }
            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? "Confirming..." : "Deposit"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Min. {MIN_DEPOSIT_SOL.toFixed(4)} SOL (rent exemption).
          {vaultLamports > 0n &&
            " Vault already has funds — withdraw first before depositing again."}
        </p>
      </div>

      {/* Withdraw Button */}
      <button
        onClick={handleWithdraw}
        disabled={isSending || vaultLamports === 0n}
        className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSending ? "Confirming..." : "Withdraw All"}
      </button>

      {/* Status */}
      {txStatus && (
        <div className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm">
          {txStatus}
        </div>
      )}

      {/* Educational Footer */}
      <div className="border-t border-border-low pt-4 text-xs text-muted">
        <p className="mb-2">
          This vault is an{" "}
          <a
            href="https://www.anchor-lang.com/docs"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline underline-offset-2"
          >
            Anchor program
          </a>{" "}
          deployed on devnet. Want to deploy your own?
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.anchor-lang.com/docs/quickstart"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-1 font-medium transition hover:bg-cream/70"
          >
            Anchor Quickstart
          </a>
          <a
            href="https://solana.com/docs/programs/deploying"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-1 font-medium transition hover:bg-cream/70"
          >
            Deploy Programs
          </a>
          <a
            href="https://github.com/ZYJLiu/anchor-vault-template"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-1 font-medium transition hover:bg-cream/70"
          >
            Reference Repo
          </a>
        </div>
      </div>
    </section>
  );
}
