import {
  ActionGetResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

// Aligné avec anchor/Anchor.toml [provider] cluster (devnet)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

const VOTING_PROGRAM_ID = new PublicKey("E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL");

const POLL_ID = 1;
const POLL_DESCRIPTION = "Peanut butter: Crunchy vs Smooth";

function anchorInstructionDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function encodeInitializePollData(
  pollId: number,
  description: string,
  pollStart: number,
  pollEnd: number
): Buffer {
  const descBytes = Buffer.from(description, "utf8");
  const buf = Buffer.alloc(8 + 4 + descBytes.length + 8 + 8);
  let off = 0;
  buf.writeBigUInt64LE(BigInt(pollId), off); off += 8;
  buf.writeUInt32LE(descBytes.length, off); off += 4;
  descBytes.copy(buf, off); off += descBytes.length;
  buf.writeBigUInt64LE(BigInt(pollStart), off); off += 8;
  buf.writeBigUInt64LE(BigInt(pollEnd), off);
  return Buffer.concat([anchorInstructionDiscriminator("initialize_poll"), buf]);
}

function encodeVoteData(pollId: number, candidate: number): Buffer {
  const buf = Buffer.alloc(8 + 8 + 1);
  anchorInstructionDiscriminator("vote").copy(buf, 0);
  buf.writeBigUInt64LE(BigInt(pollId), 8);
  buf.writeUInt8(candidate, 16);
  return buf;
}

function getPollPda(pollId: number): [PublicKey, number] {
  const seed = Buffer.alloc(8);
  seed.writeBigUInt64LE(BigInt(pollId), 0);
  return PublicKey.findProgramAddressSync([seed], VOTING_PROGRAM_ID);
}

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function GET() {
  const actionMetadata: ActionGetResponse = {
    icon: "https://www.pastrywishes.com/wp-content/uploads/2021/12/peanutbutterfeatured.jpg",
    title: "Vote for your favorite type of peanut butter!",
    description: "Vote between crunchy and smooth peanut butter. Use Devnet. If the UI times out after signing, check your wallet or the explorer — the vote may still be confirmed.",
    label: "Vote",
    links: {
      actions: [
        { type: "post", label: "Vote for Crunchy", href: "/api/vote?candidate=crunchy" },
        { type: "post", label: "Vote for Smooth", href: "/api/vote?candidate=smooth" },
      ],
    },
  };
  return NextResponse.json(actionMetadata, { headers: ACTIONS_CORS_HEADERS });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const candidate = url.searchParams.get("candidate");
  if (candidate !== "crunchy" && candidate !== "smooth") {
    return NextResponse.json(
      { message: "Invalid candidate" },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  let body: { account?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }
  const accountB58 = body.account;
  if (!accountB58 || typeof accountB58 !== "string") {
    return NextResponse.json(
      { message: "Missing account (wallet public key)" },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  const connection = new Connection(RPC_URL, "confirmed");
  let feePayer: PublicKey;
  try {
    feePayer = new PublicKey(accountB58);
  } catch {
    return NextResponse.json(
      { message: "Invalid account public key" },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  const candidateIndex = candidate === "crunchy" ? 0 : 1;
  const [pollPda] = getPollPda(POLL_ID);

  try {
    let accountInfo: Awaited<ReturnType<Connection["getAccountInfo"]>> = null;
    try {
      accountInfo = await connection.getAccountInfo(pollPda);
    } catch (rpcErr) {
      console.warn("getAccountInfo(pollPda) failed, assuming poll does not exist:", rpcErr);
    }
    const now = Math.floor(Date.now() / 1000);
    const pollStart = now;
    const pollEnd = now + 7 * 24 * 60 * 60; // 7 days

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction();
    transaction.feePayer = feePayer;
    transaction.recentBlockhash = blockhash;

    // Priority fees élevées pour confirmer plus vite et limiter "timeout reached" sur dial.to
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 })
    );

    if (!accountInfo) {
      // First vote: create the poll then vote in the same transaction
      transaction.add(
        new TransactionInstruction({
          programId: VOTING_PROGRAM_ID,
          keys: [
            { pubkey: feePayer, isSigner: true, isWritable: true },
            { pubkey: pollPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: encodeInitializePollData(
            POLL_ID,
            POLL_DESCRIPTION,
            pollStart,
            pollEnd
          ),
        })
      );
    }

    transaction.add(
      new TransactionInstruction({
        programId: VOTING_PROGRAM_ID,
        keys: [
          { pubkey: feePayer, isSigner: true, isWritable: false },
          { pubkey: pollPda, isSigner: false, isWritable: true },
        ],
        data: encodeVoteData(POLL_ID, candidateIndex),
      })
    );

    // 1 lamport vers la PDA du poll pour que le wallet détecte une modification de solde (évite l'avertissement).
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: feePayer,
        toPubkey: pollPda,
        lamports: 1,
      })
    );

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        message: `Vote for ${candidate} (Devnet). If you see "timeout reached", the vote may still have succeeded — check your wallet or https://explorer.solana.com?cluster=devnet`,
        transaction,
      },
      signers: [],
    });

    const nextHref = `${new URL(request.url).origin}/api/vote/next`;
    return NextResponse.json(
      { ...response, links: { next: { type: "post", href: nextHref } } },
      { headers: ACTIONS_CORS_HEADERS }
    );
  } catch (err) {
    console.error("Vote action transaction build failed:", err);
    const message = err instanceof Error ? err.message : "Transaction build failed";
    return NextResponse.json(
      { message },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}
 