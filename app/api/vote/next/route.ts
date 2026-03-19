import { ACTIONS_CORS_HEADERS } from "@solana/actions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: ACTIONS_CORS_HEADERS,
  });
}

/**
 * Callback appelé par le client (dial.to) après signature de la transaction.
 * Le client envoie la signature et on renvoie l’action « suivante » pour arrêter
 * l’état "Executing" et réafficher les choix (Vote Crunchy / Vote Smooth).
 */
export async function POST(request: Request) {
  let body: { account?: string; signature?: string; state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  const signature = body.signature;

  const nextAction = {
    type: "action" as const,
    icon: "https://www.pastrywishes.com/wp-content/uploads/2021/12/peanutbutterfeatured.jpg",
    title: "Vote for your favorite type of peanut butter!",
    description: signature
      ? "Vote enregistré. Vous pouvez revoter ci-dessous."
      : "Vote between crunchy and smooth peanut butter. Use Devnet in your wallet.",
    label: "Vote",
    links: {
      actions: [
        { type: "post" as const, label: "Vote for Crunchy", href: "/api/vote?candidate=crunchy" },
        { type: "post" as const, label: "Vote for Smooth", href: "/api/vote?candidate=smooth" },
      ],
    },
  };

  return NextResponse.json(nextAction, { headers: ACTIONS_CORS_HEADERS });
}
