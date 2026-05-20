import { NextResponse } from "next/server";
import { Language } from "@quranjs/api";
import { getQuranClient } from "@/lib/quran/server";

export const revalidate = 86400; // 24h — these catalogs rarely change.

/**
 * GET /api/quran/resources[?lang=en|ar]
 *
 * Returns the catalogs of translations, tafsīrs, and reciters available
 * from Quran.com so the settings popover can let users pick their preferred
 * reading. Three calls in parallel; the SDK handles auth refresh.
 *
 * The optional `lang` query parameter tells Quran.com which language to
 * populate the `translatedName` field with — when the UI is in Arabic we
 * pass `ar` so the picker shows resource names in Arabic script.
 */
export async function GET(request: Request) {
  const client = getQuranClient();
  if (!client) {
    return NextResponse.json(
      { available: false, reason: "Quran.com API credentials are not configured." },
      { status: 503 },
    );
  }

  const lang = new URL(request.url).searchParams.get("lang");
  const language = lang === "ar" ? Language.ARABIC : Language.ENGLISH;

  try {
    const [translations, tafsirs, reciters] = await Promise.all([
      client.resources.findAllTranslations({ language }),
      client.resources.findAllTafsirs({ language }),
      client.resources.findAllRecitations({ language }),
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
