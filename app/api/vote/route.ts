import { ActionGetResponse } from "@solana/actions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const actionMetadata:ActionGetResponse={
    icon:"https://www.pastrywishes.com/wp-content/uploads/2021/12/peanutbutterfeatured.jpg",
    title:"Vote for your favorite type of peanut butter!",
    description:"Vote between crunchy and smooth peanut butter.",
    label:"Vote",
  }
  return NextResponse.json(actionMetadata);
}
