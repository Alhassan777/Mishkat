import { NextResponse } from "next/server";
import type { VerseKey } from "@quranjs/api";
import { getQuranClient } from "@/lib/quran/server";

export const revalidate = false; // Quran text is immutable.

/**
 * GET /api/quran/verse/2:255?words=true&translation=131&tafsir=169&reciter=7
 *
 * Returns a Verse object including the requested enrichments. We map
 * directly through the SDK's findByKey so the client only needs to know
 * about one shape.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const client = getQuranClient();
  if (!client) {
    return NextResponse.json(
      { available: false, reason: "Quran.com API credentials are not configured." },
      { status: 503 },
    );
  }

  const { key } = await params;
  const url = new URL(req.url);
  const words = url.searchParams.get("words") === "true";
  const translation = url.searchParams.get("translation");
  const tafsir = url.searchParams.get("tafsir");
  const reciter = url.searchParams.get("reciter");

  // Validate key shape (e.g. "2:255")
  if (!/^\d{1,3}:\d{1,3}$/.test(key)) {
    return NextResponse.json({ error: "Invalid verse key" }, { status: 400 });
  }

  try {
    // The /verses/by_key endpoint doesn't return verse-level audio even when
    // a reciter is provided — that comes from a separate recitations call.
    // Fetch both in parallel and merge the audio URL into the verse object.
    const versePromise = client.verses.findByKey(key as VerseKey, {
      words,
      translations: translation ? [translation] : undefined,
      tafsirs: tafsir ? [tafsir] : undefined,
      reciter: reciter ?? undefined,
      fields: { textUthmani: true },
      wordFields: words ? { textUthmani: true } : undefined,
      translationFields: translation ? { resourceName: true, languageName: true } : undefined,
    });

    const audioPromise = reciter
      ? client.audio
          .findVerseRecitationsByKey(key as VerseKey, reciter)
          .then((r) => r.audioFiles?.[0]?.audioUrl)
          .catch(() => undefined)
      : Promise.resolve(undefined);

    const [verse, audioUrl] = await Promise.all([versePromise, audioPromise]);
    if (audioUrl) {
      verse.audio = { ...(verse.audio ?? {}), url: audioUrl, verseKey: key };
    }

    return NextResponse.json({ available: true, verse });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ available: true, error: message }, { status: 502 });
  }
}
