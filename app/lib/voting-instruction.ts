/**
 * Construction des instructions Vote / InitializePoll pour le programme Voting (Anchor).
 * Aligné avec anchor/programs/voting. Utilisable côté client (app) et cohérent avec l’API /api/vote.
 */

import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const VOTING_PROGRAM_ID = new PublicKey(
  "E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL"
);

export const POLL_ID = 1;
const POLL_DESCRIPTION = "Peanut butter: Crunchy vs Smooth";

/** Discriminateur "initialize_poll" (IDL). */
const INIT_POLL_DISCRIMINATOR = new Uint8Array([
  193, 22, 99, 197, 18, 33, 115, 117,
]);
/** Discriminateur "vote" (IDL). */
const VOTE_DISCRIMINATOR = new Uint8Array([227, 110, 155, 23, 136, 126, 172, 25]);

export function getPollPda(pollId: number): [PublicKey, number] {
  const seed = new Uint8Array(8);
  new DataView(seed.buffer).setBigUint64(0, BigInt(pollId), true);
  return PublicKey.findProgramAddressSync([seed], VOTING_PROGRAM_ID);
}

/** Crée l’instruction initialize_poll si le poll n’existe pas encore. */
export function createInitializePollInstruction(
  feePayer: PublicKey
): TransactionInstruction {
  const [pollPda] = getPollPda(POLL_ID);
  const now = Math.floor(Date.now() / 1000);
  const pollStart = now;
  const pollEnd = now + 7 * 24 * 60 * 60;
  const descBytes = new TextEncoder().encode(POLL_DESCRIPTION);
  const data = new Uint8Array(
    8 + 8 + 4 + descBytes.length + 8 + 8
  );
  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );
  let off = 0;
  data.set(INIT_POLL_DISCRIMINATOR, off);
  off += 8;
  view.setBigUint64(off, BigInt(POLL_ID), true);
  off += 8;
  view.setUint32(off, descBytes.length, true);
  off += 4;
  data.set(descBytes, off);
  off += descBytes.length;
  view.setBigUint64(off, BigInt(pollStart), true);
  off += 8;
  view.setBigUint64(off, BigInt(pollEnd), true);

  return new TransactionInstruction({
    programId: VOTING_PROGRAM_ID,
    keys: [
      { pubkey: feePayer, isSigner: true, isWritable: true },
      { pubkey: pollPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** candidate: 0 = crunchy, 1 = smooth. */
export function createVoteInstruction(
  feePayer: PublicKey,
  candidate: 0 | 1
): TransactionInstruction {
  const [pollPda] = getPollPda(POLL_ID);
  const data = new Uint8Array(8 + 8 + 1);
  data.set(VOTE_DISCRIMINATOR, 0);
  new DataView(data.buffer).setBigUint64(8, BigInt(POLL_ID), true);
  data[16] = candidate;

  return new TransactionInstruction({
    programId: VOTING_PROGRAM_ID,
    keys: [
      { pubkey: feePayer, isSigner: true, isWritable: false },
      { pubkey: pollPda, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/** Instruction transfer 1 lamport vers la PDA du poll (pour affichage « modification de solde »). */
export function createTransferToPollInstruction(
  feePayer: PublicKey
): TransactionInstruction {
  const [pollPda] = getPollPda(POLL_ID);
  return SystemProgram.transfer({
    fromPubkey: feePayer,
    toPubkey: pollPda,
    lamports: 1,
  });
}
