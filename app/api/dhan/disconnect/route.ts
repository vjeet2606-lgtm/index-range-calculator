import { NextResponse } from "next/server";
import { clearSession } from "@/lib/dhan/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ status: "disconnected" });
}
