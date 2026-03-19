"use client";

import { useState, useCallback } from "react";
import {
  useWalletConnection,
  useWalletSession,
  useSendTransaction,
} from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import { AccountRole } from "@solana/kit";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createVoteInstruction,
  createTransferToPollInstruction,
  createInitializePollInstruction,
  getPollPda,
  VOTING_PROGRAM_ID,
  POLL_ID,
} from "../lib/voting-instruction";

/** RPC Devnet uniquement pour le vote (évite mainnet si NEXT_PUBLIC_RPC_URL est défini). */
const DEVNET_RPC =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEVNET_RPC
    ? process.env.NEXT_PUBLIC_DEVNET_RPC
    : "https://api.devnet.solana.com";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return "Unknown error";
}

function getErrorCause(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const o = err as Record<string, unknown>;
  if ("context" in o && o.context && typeof o.context === "object") {
    const ctx = o.context as Record<string, unknown>;
    if ("cause" in ctx) {
      const cause = ctx.cause;
      if (cause instanceof Error) return cause.message;
      if (cause && typeof cause === "object" && "message" in cause)
        return String((cause as { message: unknown }).message);
      if (cause != null) return String(cause);
    }
  }
  if ("cause" in o && o.cause instanceof Error) return o.cause.message;
  if ("cause" in o && o.cause != null) return String(o.cause);
  return null;
}

const USER_REJECTION_PATTERN = /reject|cancel|user rejected|denied|refused/i;
const SIMULATION_PATTERN =
  /simulation|transaction plan failed|failed to execute|program failed/i;

function isUserRejection(err: unknown): boolean {
  const message = getErrorMessage(err);
  const cause = getErrorCause(err);
  const all = [message, cause].filter(
    (s): s is string => s !== null && s !== undefined
  );
  return all.some((s) => USER_REJECTION_PATTERN.test(s));
}

function getSimulationFailureHint(err: unknown): string | null {
  const message = getErrorMessage(err);
  const cause = getErrorCause(err);
  const all = [message, cause].filter(
    (s): s is string => s !== null && s !== undefined
  );
  if (all.some((s) => SIMULATION_PATTERN.test(s)))
    return "Simulation failed. Switch your wallet to Devnet and try again. If it still fails, ensure the voting program is deployed (anchor deploy --provider.cluster devnet --no-idl).";
  return null;
}

/** Convertit une instruction web3.js au format attendu par useSendTransaction (programAddress + accounts + data). */
function toSendInstruction(ix: {
  programId: PublicKey;
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}) {
  return {
    programAddress: ix.programId.toBase58() as `${string}`,
    accounts: ix.keys.map((k) => ({
      address: k.pubkey.toBase58() as `${string}`,
      role: k.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY,
      ...(k.isSigner && { signer: true as const }),
    })),
    data: ix.data,
  };
}

export function VotingCard() {
  const { status } = useWalletConnection();
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const handleVote = useCallback(
    async (candidate: 0 | 1) => {
      if (!session) return;
      const label = candidate === 0 ? "Crunchy" : "Smooth";
      try {
        setTxStatus(`Building vote for ${label}...`);
        const { signer } = createWalletTransactionSigner(session);
        const feePayer = new PublicKey(signer.address);

        const connection = new Connection(DEVNET_RPC);
        const programAccount = await connection.getAccountInfo(VOTING_PROGRAM_ID);
        if (!programAccount?.executable) {
          setTxStatus(
            "Voting program is not deployed on Devnet. Run: anchor deploy --provider.cluster devnet --no-idl (from the anchor folder)."
          );
          return;
        }
        const [pollPda] = getPollPda(POLL_ID);
        const pollAccount = await connection.getAccountInfo(pollPda);

        const rawIxs: import("@solana/web3.js").TransactionInstruction[] = [];
        if (!pollAccount) {
          rawIxs.push(createInitializePollInstruction(feePayer));
        }
        rawIxs.push(
          createVoteInstruction(feePayer, candidate),
          createTransferToPollInstruction(feePayer)
        );

        const tx = new Transaction();
        tx.add(...rawIxs);
        tx.feePayer = feePayer;
        const { blockhash } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;

        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          const logs = sim.value.logs ?? [];
          const logStr =
            logs.length > 0
              ? logs.slice(-5).join(" ")
              : String(sim.value.err);
          setTxStatus(
            `Simulation failed on Devnet: ${logStr}. Ensure the voting program is deployed and the poll exists.`
          );
          return;
        }

        const instructions: ReturnType<typeof toSendInstruction>[] =
          rawIxs.map((ix) => toSendInstruction(ix));

        setTxStatus(`Awaiting signature (${label})...`);

        const signature = await send(
          {
            instructions,
            authority: signer,
            feePayer: signer.address,
          },
          { skipPreflight: true }
        );

        if (signature) {
          console.log("[Voting] Vote transaction signature:", signature);
          console.log(
            "[Voting] Explorer (devnet):",
            `https://explorer.solana.com/tx/${signature}?cluster=devnet`
          );
        }
        setTxStatus(`Vote for ${label} recorded. Signature: ${signature?.slice(0, 20)}...`);
      } catch (err) {
        if (isUserRejection(err)) {
          setTxStatus("Vote cancelled by user.");
          return;
        }
        const hint = getSimulationFailureHint(err);
        if (hint) setTxStatus(hint);
        else {
          console.error("Vote failed:", err);
          const message = getErrorMessage(err);
          const cause = getErrorCause(err);
          setTxStatus(
            cause ? `Error: ${message}. ${cause}` : `Error: ${message}`
          );
        }
      }
    },
    [session, send]
  );

  if (status !== "connected") {
    return (
      <section className="w-full max-w-4xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Peanut butter vote</p>
          <p className="text-sm text-muted">
            Connect your wallet to vote (Devnet).
          </p>
        </div>
        <div className="rounded-lg bg-cream/50 p-4 text-center text-sm text-muted">
          Wallet not connected
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-4xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Peanut butter vote</p>
        <p className="text-sm text-muted">
          Vote for your favorite. Use <strong>Devnet</strong> in your wallet.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleVote(0)}
          disabled={isSending}
          className="flex-1 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Vote for Crunchy"}
        </button>
        <button
          onClick={() => handleVote(1)}
          disabled={isSending}
          className="flex-1 rounded-lg border border-border-low bg-card px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Vote for Smooth"}
        </button>
      </div>

      {txStatus && (
        <div className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm">
          {txStatus}
        </div>
      )}

      <div className="border-t border-border-low pt-4 text-xs text-muted">
        <p>
          Votes are recorded on-chain (Anchor program on devnet). You can also
          use the{" "}
          <a
            href="https://dial.to"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline underline-offset-2"
          >
            Solana Action
          </a>{" "}
          (dial.to) with this app’s API.
        </p>
      </div>
    </section>
  );
}
