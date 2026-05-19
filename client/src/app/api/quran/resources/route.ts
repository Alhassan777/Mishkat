import { NextResponse } from "next/server";
import { getQuranClient } from "@/lib/quran/server";

export const revalidate = 86400; // 24h — these catalogs rarely change.

/**
 * GET /api/quran/resources
 *
 * Returns the catalogs of translations, tafsīrs, and reciters available
 * from Quran.com so the settings popover can let users pick their preferred
 * reading. Three calls in parallel; the SDK handles auth refresh.
 */
export async function GET() {
  const client = getQuranClient();
  if (!client) {
    return NextResponse.json(
      { available: false, reason: "Quran.com API credentials are not configured." },
      { status: 503 },
    );
  }

  try {
    const [translations, tafsirs, reciters] = await Promise.all([
      client.resources.findAllTranslations(),
      client.resources.findAllTafsirs(),
      client.resources.findAllRecitations(),
    ]);
    return NextResponse.json({
      available: true,
      translations,
      tafsirs,
      reciters,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ available: true, error: message }, { status: 502 });
  }
}
