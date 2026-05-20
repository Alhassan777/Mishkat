"""Run extraction pipeline on all 14 books sequentially."""
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.mutashabihat.config import DEFAULT_SOURCE_DIR, gemini_settings

BOOK_SLUGS = [
    # "book_22_iskafi_durra_tanzil",  # skipped — already ran most of it
    "book_79_karmani_burhan",
    "book_276_shinqiti_daf_iham",
    "book_404_askari_wujuh_nazair",
    "book_30_ibn_jamaah_kashf_maani",
    "book_326_ibn_qutayba_tawil_mushkil",
    "book_100_makki_mushkil_irab",
    "book_166_ansari_fath_rahman",
    "book_172_ibn_taymiyya_iklil",
    "book_185_sakhawi_hidayat_murtab",
    "book_248_yahya_ibn_sallam_tasarif",
    "book_1392_darwish_irab_quran",
    "book_1508_ibn_jawzi_nuzhat_ayn",
    "book_26752_ibn_zubayr_malak_tawil",
]


def main():
    from pipeline.cli.extract import run

    settings = gemini_settings()
    source_dir = Path(DEFAULT_SOURCE_DIR)
    model = settings["model"]
    delay = settings["delay_seconds"]

    results = []
    total_start = time.time()

    for i, slug in enumerate(BOOK_SLUGS, 1):
        print(f"\n{'=' * 70}")
        print(f"[{i}/{len(BOOK_SLUGS)}] Starting: {slug}")
        print(f"{'=' * 70}")
        book_start = time.time()
        try:
            run(slug, source_dir, model, limit=None, force=False, delay=delay)
            elapsed = time.time() - book_start
            results.append((slug, "OK", elapsed))
            print(f"[{i}/{len(BOOK_SLUGS)}] Finished: {slug} in {elapsed:.0f}s")
        except Exception as e:
            elapsed = time.time() - book_start
            results.append((slug, f"ERROR: {e}", elapsed))
            print(f"[{i}/{len(BOOK_SLUGS)}] FAILED: {slug} - {e}")

    total_elapsed = time.time() - total_start
    print(f"\n{'=' * 70}")
    print(f"ALL DONE - {len(BOOK_SLUGS)} books in {total_elapsed:.0f}s ({total_elapsed/60:.1f}min)")
    print(f"{'=' * 70}")
    for slug, status, elapsed in results:
        print(f"  {slug:<50s} {status:<10s} {elapsed:.0f}s")


if __name__ == "__main__":
    main()
