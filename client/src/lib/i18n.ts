"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category } from "@/types/graph";

export type Lang = "en" | "ar";

type Dict = {
  brand: string;
  searchHint: string;
  searchExample: string;
  searchPlaceholder: string;
  searchEsc: string;
  searchNoMatch: (ref: string) => React.ReactNode | string;
  filterHintIdle: string;
  filterHintOne: string;
  filterHintMany: (n: number) => string;
  filterLens: string;
  filterClear: string;
  category: Record<Category, string>;
  signIn: string;
  signOut: string;
  signInToSave: string;
  save: string;
  saved: string;
  bookmarksAria: string;
  bookmarksTitleEmpty: string;
  bookmarksTitleCount: (n: number) => string;
  bookmarksEyebrow: string;
  bookmarksEmptyHint: string;
  bookmarksRemove: string;
  bookmarksVerseUnavailable: string;
  drawerCluster: string;
  drawerSurah: (n: number, name: string) => string;
  drawerJuz: string;
  drawerHizb: string;
  drawerConnections: string;
  drawerThreads: (n: number) => string;
  drawerHiddenLens: (n: number) => string;
  drawerNoThreads: (n: number) => string;
  drawerMoreInSettings: string;
  drawerBackTo: (ref: string) => string;
  drawerComparison: string;
  drawerReadings: (n: number) => string;
  drawerTheReadings: string;
  drawerDiffHint: string;
  drawerWajh: string;
  drawerConfidence: string;
  drawerClose: string;
  audioRecite: string;
  loadingDrawing: string;
  errorEyebrow: string;
  settingsTitle: string;
  settingsSubtitle: string;
  settingsLangLabel: string;
  settingsLangHint: string;
  settingsWordByWord: string;
  settingsWordByWordHint: string;
  settingsTranslation: string;
  settingsTranslationHint: string;
  settingsTafsir: string;
  settingsTafsirHint: string;
  settingsTranslationPicker: string;
  settingsTafsirPicker: string;
  settingsReciter: string;
  settingsSetup: string;
  settingsSetupBody: string;
  settingsAria: string;
  tafsirCommentary: string;
  tafsirFallback: string;
};

const en: Dict = {
  brand: "Mishkāt — Mutashābihāt Visualizer",
  searchHint: "Search",
  searchExample: "2:255 · al-baqarah",
  searchPlaceholder: "Reference (2:255), surah, or any Arabic phrase",
  searchEsc: "Esc",
  searchNoMatch: () => "No āyah matched. Try a reference like 4:56.",
  filterHintIdle: "Isolate threads by kind of similarity",
  filterHintOne: "Showing one lens — others dimmed",
  filterHintMany: (n) => `Showing ${n} lenses — others dimmed`,
  filterLens: "Lens",
  filterClear: "Clear",
  category: {
    structural: "Structural",
    semantic: "Semantic",
    doctrinal: "Doctrinal",
    lexical: "Lexical",
    cross_surah_refrain: "Refrain",
    thematic: "Thematic",
    "": "Other",
  },
  signIn: "Sign in",
  signOut: "Sign out",
  signInToSave: "Sign in to save",
  save: "Save",
  saved: "Saved",
  bookmarksAria: "Saved āyāt",
  bookmarksTitleEmpty: "Nothing saved yet",
  bookmarksTitleCount: (n) => `${n} bookmark${n === 1 ? "" : "s"}`,
  bookmarksEyebrow: "Your saved āyāt",
  bookmarksEmptyHint: "Open any āyah and tap the bookmark to save it here.",
  bookmarksRemove: "Remove bookmark",
  bookmarksVerseUnavailable: "Verse text unavailable",
  drawerCluster: "Cluster",
  drawerSurah: (n, name) => `Sūrah ${n} · ${name}`,
  drawerJuz: "Juzʾ",
  drawerHizb: "Hizb ¼",
  drawerConnections: "Connections",
  drawerThreads: (n) => `${n} thread${n === 1 ? "" : "s"}`,
  drawerHiddenLens: (n) => `${n} more outside the active lens`,
  drawerNoThreads: (n) =>
    `No threads of this kind reach this āyah. Clear the lens to see all ${n}.`,
  drawerMoreInSettings: "· enable audio & translation in settings",
  drawerBackTo: (ref) => `Back to ${ref}`,
  drawerComparison: "Comparison",
  drawerReadings: (n) => `${n} reading${n === 1 ? "" : "s"}`,
  drawerTheReadings: "The readings",
  drawerDiffHint: "Highlighted words appear in one āyah but not the other",
  drawerWajh: "wajh:",
  drawerConfidence: "confidence",
  drawerClose: "Close",
  audioRecite: "Recite",
  loadingDrawing: "Drawing the threads…",
  errorEyebrow: "The sea is silent",
  settingsTitle: "Preferences",
  settingsSubtitle: "Reading & recitation",
  settingsLangLabel: "Interface language",
  settingsLangHint: "Switch between English and Arabic",
  settingsWordByWord: "Word-by-word",
  settingsWordByWordHint: "Hover any word for meaning + transliteration",
  settingsTranslation: "Translation",
  settingsTranslationHint: "Show the verse translation under the Arabic text",
  settingsTafsir: "Tafsīr",
  settingsTafsirHint: "Show classical commentary in the detail drawer",
  settingsTranslationPicker: "Translation",
  settingsTafsirPicker: "Tafsīr",
  settingsReciter: "Reciter",
  settingsSetup: "Setup required",
  settingsSetupBody:
    "Quran.com API credentials are not configured. Add QURAN_CLIENT_ID and QURAN_CLIENT_SECRET to .env.local to enable word-by-word, audio, translations, and tafsīr.",
  settingsAria: "Settings",
  tafsirCommentary: "Commentary",
  tafsirFallback: "Tafsīr",
};

const ar: Dict = {
  brand: "مشكاة — مُتشابهات القرآن",
  searchHint: "ابحث",
  searchExample: "٢:٢٥٥ · البقرة",
  searchPlaceholder: "مرجع (٢:٢٥٥)، سورة، أو أي عبارة عربية",
  searchEsc: "ESC",
  searchNoMatch: () => "لم تُطابق أي آية. جرّب مرجعًا مثل ٤:٥٦.",
  filterHintIdle: "اعزل الخيوط حسب نوع التشابه",
  filterHintOne: "تعرض عدسة واحدة — الباقي مُعتم",
  filterHintMany: (n) => `تعرض ${n} عدسات — الباقي مُعتم`,
  filterLens: "عدسة",
  filterClear: "مسح",
  category: {
    structural: "بنيوي",
    semantic: "دلالي",
    doctrinal: "عقدي",
    lexical: "لفظي",
    cross_surah_refrain: "تكرار",
    thematic: "موضوعي",
    "": "أخرى",
  },
  signIn: "تسجيل الدخول",
  signOut: "تسجيل الخروج",
  signInToSave: "ادخل للحفظ",
  save: "احفظ",
  saved: "محفوظة",
  bookmarksAria: "الآيات المحفوظة",
  bookmarksTitleEmpty: "لا شيء محفوظ بعد",
  bookmarksTitleCount: (n) => `${n} علامة محفوظة`,
  bookmarksEyebrow: "آياتك المحفوظة",
  bookmarksEmptyHint: "افتح أي آية واضغط على رمز الحفظ لتظهر هنا.",
  bookmarksRemove: "إزالة العلامة",
  bookmarksVerseUnavailable: "نص الآية غير متاح",
  drawerCluster: "العنقود",
  drawerSurah: (n, name) => `سورة ${n} · ${name}`,
  drawerJuz: "جزء",
  drawerHizb: "ربع الحزب",
  drawerConnections: "الروابط",
  drawerThreads: (n) => `${n} خيط`,
  drawerHiddenLens: (n) => `${n} خارج العدسة الحالية`,
  drawerNoThreads: (n) =>
    `لا توجد خيوط من هذا النوع لهذه الآية. امسح العدسة لرؤية الـ ${n} كلها.`,
  drawerMoreInSettings: "· فعّل الصوت والترجمة من الإعدادات",
  drawerBackTo: (ref) => `العودة إلى ${ref}`,
  drawerComparison: "مقارنة",
  drawerReadings: (n) => `${n} قراءة`,
  drawerTheReadings: "القراءات",
  drawerDiffHint: "الكلمات المميّزة تظهر في إحدى الآيتين دون الأخرى",
  drawerWajh: "وجه:",
  drawerConfidence: "ثقة",
  drawerClose: "إغلاق",
  audioRecite: "تلاوة",
  loadingDrawing: "تُنسج الخيوط…",
  errorEyebrow: "البحر صامت",
  settingsTitle: "التفضيلات",
  settingsSubtitle: "القراءة والتلاوة",
  settingsLangLabel: "لغة الواجهة",
  settingsLangHint: "بدّل بين العربية والإنجليزية",
  settingsWordByWord: "كلمة كلمة",
  settingsWordByWordHint: "مرّر فوق أي كلمة لرؤية المعنى والنطق",
  settingsTranslation: "الترجمة",
  settingsTranslationHint: "إظهار ترجمة الآية تحت النص العربي",
  settingsTafsir: "التفسير",
  settingsTafsirHint: "إظهار التفسير الكلاسيكي في لوحة التفاصيل",
  settingsTranslationPicker: "الترجمة",
  settingsTafsirPicker: "التفسير",
  settingsReciter: "القارئ",
  settingsSetup: "إعداد مطلوب",
  settingsSetupBody:
    "بيانات اعتماد Quran.com غير مُهيّأة. أضف QURAN_CLIENT_ID و QURAN_CLIENT_SECRET إلى .env.local لتفعيل كلمة كلمة، والصوت، والترجمة، والتفسير.",
  settingsAria: "الإعدادات",
  tafsirCommentary: "التفسير",
  tafsirFallback: "تفسير",
};

const DICTS: Record<Lang, Dict> = { en, ar };

type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

export const useLang = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      toggle: () => set({ lang: get().lang === "en" ? "ar" : "en" }),
    }),
    { name: "ayat-lang", version: 1 },
  ),
);

/**
 * Hook returning the translation dictionary for the active language.
 * Components call `const t = useT()` then `t.someKey`.
 */
export function useT(): Dict & { lang: Lang; isRTL: boolean } {
  const lang = useLang((s) => s.lang);
  const d = DICTS[lang];
  return Object.assign({}, d, { lang, isRTL: lang === "ar" });
}

/**
 * Syncs the active language to <html lang> and <html dir>, and toggles
 * a `data-lang-ar` attribute on the document so CSS can swap the default
 * UI font to Readex Arabic when Arabic is active.
 */
export function useApplyLangToDocument() {
  const lang = useLang((s) => s.lang);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    root.dataset.langAr = lang === "ar" ? "true" : "";
  }, [lang]);
}
