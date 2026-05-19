import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOAuthConfig } from "@/lib/quran/oauth";

/**
 * GET /api/auth/me — minimal "am I signed in?" check the UI calls on
 * mount and after sign-in. Never returns tokens to the client.
 */
export async function GET() {
  const configured = !!getOAuthConfig();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ signedIn: false, configured });
  }
  return NextResponse.json({
    signedIn: true,
    configured,
    expiresAt: session.expiresAt,
  });
}
