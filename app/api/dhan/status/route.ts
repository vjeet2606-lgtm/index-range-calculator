import { NextResponse } from "next/server";
import { getSession, maskClientId } from "@/lib/dhan/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "disconnected" });
  }
  return NextResponse.json({ status: "connected", clientIdMasked: maskClientId(session.clientId) });
}
