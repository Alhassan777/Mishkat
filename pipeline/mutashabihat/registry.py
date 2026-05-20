from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BookRegistryItem:
    shamela_id: int
    slug: str
    tier: str


BOOK_REGISTRY: dict[int, tuple[str, str]] = {
    1340: ("book_22_iskafi_durra_tanzil", "tier1_poc_core"),
    3580: ("book_79_karmani_burhan", "tier1_poc_core"),
    18007: ("book_276_shinqiti_daf_iham", "tier1_poc_core"),
    37586: ("book_404_askari_wujuh_nazair", "tier1_poc_core"),
    1403: ("book_30_ibn_jamaah_kashf_maani", "tier2_enhancement"),
    23596: ("book_326_ibn_qutayba_tawil_mushkil", "tier2_enhancement"),
    5538: ("book_100_makki_mushkil_irab", "future_expansion"),
    9086: ("book_166_ansari_fath_rahman", "future_expansion"),
    9220: ("book_172_ibn_taymiyya_iklil", "future_expansion"),
    9831: ("book_185_sakhawi_hidayat_murtab", "future_expansion"),
    11783: ("book_248_yahya_ibn_sallam_tasarif", "future_expansion"),
    2163: ("book_1392_darwish_irab_quran", "future_expansion"),
    6334: ("book_1508_ibn_jawzi_nuzhat_ayn", "future_expansion"),
    1419: ("book_26752_ibn_zubayr_malak_tawil", "future_expansion"),
}

SLUG_TO_ID = {slug: sid for sid, (slug, _) in BOOK_REGISTRY.items()}


def get_book_by_slug(slug: str) -> BookRegistryItem | None:
    sid = SLUG_TO_ID.get(slug)
    if sid is None:
        return None
    reg_slug, tier = BOOK_REGISTRY[sid]
    return BookRegistryItem(shamela_id=sid, slug=reg_slug, tier=tier)

