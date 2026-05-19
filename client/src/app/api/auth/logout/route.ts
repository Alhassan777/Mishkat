import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ signedIn: false });
}

// Allow GET too so the user can hit /api/auth/logout in a browser tab
// during development.
export async function GET(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/", req.url));
}
