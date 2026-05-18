from __future__ import annotations

import re

TASHKEEL_RE = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670]")
TATWEEL_RE = re.compile(r"\u0640")
WS_RE = re.compile(r"\s+")


def normalize_arabic(text: str) -> str:
    if not text:
        return ""
    s = TASHKEEL_RE.sub("", text)
    s = TATWEEL_RE.sub("", s)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي")
    return WS_RE.sub(" ", s).strip()

