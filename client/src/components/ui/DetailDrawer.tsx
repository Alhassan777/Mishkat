"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/lib/store";
import { useSettings } from "@/lib/settings-store";
import { useT } from "@/lib/i18n";
import { resolveTafsirId, tafsirLabel, tafsirLanguage } from "@/lib/quran/tafsirs";
import { useVerse } from "@/lib/quran/useVerse";
import { WordTokens } from "@/components/quran/WordTokens";
import { TranslationLine } from "@/components/quran/TranslationLine";
import { AudioButton } from "@/components/quran/AudioButton";
import { TafsirPanel } from "@/components/quran/TafsirPanel";
import { diffWordSets } from "@/components/quran/diff";
import { SaveAyahButton } from "@/components/ui/SaveAyahButton";
import { CATEGORY_COLOR, type Category, type Edge, type GraphData, type Opinion } from "@/types/graph";

export function DetailDrawer() {
  const graph = useGraphStore((s) => s.graph);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);
  const setSelected = useGraphStore((s) => s.setSelectedNode);
  const setEdge = useGraphStore((s) => s.setSelectedEdge);

  const open = !!selectedNode && !!graph;

  return (
    <aside
      className={`pointer-events-auto absolute right-0 top-0 z-40 flex h-full w-[min(460px,92vw)] flex-col border-l border-hairline bg-ocean-deep/85 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {open && graph && (
        selectedEdge ? (
          <ComparisonView
            graph={graph}
            pair={selectedEdge}
            onBack={() => setEdge(null)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <NodeView
            graph={graph}
            id={selectedNode!}
            onClose={() => setSelected(null)}
          />
        )
      )}
    </aside>
  );
}

/* -------------------------------- NodeView -------------------------------- */

function NodeView({ graph, id, onClose }: { graph: GraphData; id: string; onClose: () => void }) {
  const node = graph.nodes[id];
  const setEdge = useGraphStore((s) => s.setSelectedEdge);
  const activeCategories = useGraphStore((s) => s.activeCategories);
  const s = useSettings();
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";

  const enrichment = useVerse(id, {
    words: s.showWordByWord,
    translation: s.showTranslation ? s.translationId : undefined,
    tafsir: s.showTafsir ? resolveTafsirId(s.tafsirKey, t.lang) : undefined,
    reciter: s.reciterId,
  });
  const verse = enrichment?.available && !enrichment.error ? enrichment.verse : undefined;

  const allCount = node.e.length;
  const edges = useMemo(() => {
    const list = node.e.map((i) => ({ idx: i, edge: graph.edges[i] }));
    const filtered =
      activeCategories.size === 0
        ? list
        : list.filter(({ edge }) => activeCategories.has(edge.pc));
    return filtered.sort((a, b) => b.edge.w - a.edge.w);
  }, [graph, node, activeCategories]);
  const hiddenCount = allCount - edges.length;

  return (
    <>
      <DrawerHeader
        eyebrow={t.drawerSurah(node.s, node.sn)}
        title={`${node.s}:${node.a}`}
        onClose={onClose}
      />

      <div className="thin-scroll flex-1 overflow-y-auto px-7 pb-12">
        <SurahCard node={node} />

        <div className="rise mt-7">
          <VerseBody node={node} verse={verse} size={28} />
          <div className="mt-4 flex items-center gap-2">
            <AudioButton url={verse?.audio?.url} label={t.audioRecite} />
            <SaveAyahButton verseKey={id} />
            {enrichment && !enrichment.available && (
              <span className={`text-[10.5px] uppercase tracking-[0.22em] text-text-faint ${sansForLang}`}>
                {t.drawerMoreInSettings}
              </span>
            )}
          </div>
        </div>

        {s.showTafsir && verse?.tafsirs?.[0] && (
          <TafsirPanel
            tafsir={verse.tafsirs[0]}
            attribution={tafsirLabel(s.tafsirKey, t.lang)}
            language={tafsirLanguage(s.tafsirKey, t.lang)}
          />
        )}

        <Meta label={t.drawerJuz} value={`${node.j}`} secondary={`${t.drawerHizb} · ${node.hq}`} />

        <SectionHeading left={t.drawerConnections} right={t.drawerThreads(edges.length)} />

        {hiddenCount > 0 && (
          <p className={`mt-2 text-[10.5px] uppercase tracking-[0.22em] text-text-faint ${sansForLang}`}>
            {t.drawerHiddenLens(hiddenCount)}
          </p>
        )}
        {edges.length === 0 && (
          <p className={`mt-4 rounded-lg border border-hairline bg-surface/40 px-4 py-5 text-center text-[12.5px] text-text-muted ${sansForLang}`}>
            {t.drawerNoThreads(allCount)}
          </p>
        )}

        <ul className="mt-3 flex flex-col gap-2" dir="rtl">
          {edges.map(({ idx, edge }) => {
            const otherId = edge.a === id ? edge.b : edge.a;
            const other = graph.nodes[otherId];
            return (
              <li key={idx}>
                <button
                  onClick={() => setEdge([id, otherId])}
                  dir="rtl"
                  className="group w-full rounded-lg border border-hairline bg-surface/40 px-4 py-3 text-start transition hover:border-hairline-strong hover:bg-surface/70"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-sans text-[12px] tracking-wider text-ink">
                      {other.s}:{other.a}
                      <span className={`ml-2 text-text-faint ${sansForLang}`}>{other.sn}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DotsForOpinions ops={edge.ops} />
                      <span className="ml-1 font-sans text-[10.5px] uppercase tracking-[0.2em] text-text-faint">
                        {edge.ops.length}
                      </span>
                    </div>
                  </div>
                  <p
                    className="mt-2 line-clamp-2 font-quran text-[18px] leading-[1.7] text-text-muted group-hover:text-text"
                    dir="rtl"
                    lang="ar"
                  >
                    {other.t}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/* ----------------------------- ComparisonView ----------------------------- */

function ComparisonView({
  graph,
  pair,
  onBack,
  onClose,
}: {
  graph: GraphData;
  pair: [string, string];
  onBack: () => void;
  onClose: () => void;
}) {
  const [idA, idB] = pair;
  const a = graph.nodes[idA];
  const b = graph.nodes[idB];
  const s = useSettings();
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";

  const eA = useVerse(idA, {
    words: s.showWordByWord,
    translation: s.showTranslation ? s.translationId : undefined,
    reciter: s.reciterId,
  });
  const eB = useVerse(idB, {
    words: s.showWordByWord,
    translation: s.showTranslation ? s.translationId : undefined,
    reciter: s.reciterId,
  });
  const verseA = eA?.available && !eA.error ? eA.verse : undefined;
  const verseB = eB?.available && !eB.error ? eB.verse : undefined;

  // Diff masks — which word positions are unique to one ayah vs. the other.
  const { maskA, maskB } = useMemo(() => {
    const wordsOf = (vs: typeof verseA) =>
      (vs?.words ?? [])
        .filter((w) => w.charTypeName === "word")
        .map((w) => w.textUthmani ?? w.text ?? "");
    const wa = wordsOf(verseA);
    const wb = wordsOf(verseB);
    if (wa.length === 0 || wb.length === 0)
      return { maskA: undefined, maskB: undefined };
    const { uniqueA, uniqueB } = diffWordSets(wa, wb);
    return { maskA: uniqueA, maskB: uniqueB };
  }, [verseA, verseB]);

  // Find the edge.
  const edge = useMemo<Edge | null>(() => {
    const [lo, hi] = [idA, idB].sort();
    for (const ei of a.e) {
      const e = graph.edges[ei];
      if (e.a === lo && e.b === hi) return e;
    }
    return null;
  }, [graph, idA, idB, a]);

  if (!edge) return null;

  return (
    <>
      <DrawerHeader
        eyebrow={
          <button onClick={onBack} className="flex items-center gap-1.5 transition hover:text-text">
            <ArrowLeft flipped={t.isRTL} />
            <span>{t.drawerBackTo(`${a.s}:${a.a}`)}</span>
          </button>
        }
        title={t.drawerComparison}
        titleIsArabic={t.isRTL}
        onClose={onClose}
      />

      <div className="thin-scroll flex-1 overflow-y-auto px-7 pb-12">
        <div className="mt-2 flex items-center gap-3">
          <CategoryChip cat={edge.pc} />
          <span className={`text-[10.5px] uppercase tracking-[0.24em] text-text-faint ${sansForLang}`}>
            {t.drawerReadings(edge.ops.length)}
          </span>
        </div>

        <AyahCard side="A" node={a} verse={verseA} diffMask={maskA} />
        <Divider />
        <AyahCard side="B" node={b} verse={verseB} diffMask={maskB} />

        {(maskA?.size || maskB?.size) && s.showWordByWord ? (
          <p className={`mt-4 text-[10.5px] uppercase tracking-[0.22em] text-text-faint ${sansForLang}`}>
            {t.drawerDiffHint}
          </p>
        ) : null}

        <SectionHeading left={t.drawerTheReadings} right={`${edge.ops.length}`} />

        <div className="mt-3 flex flex-col gap-3">
          {edge.ops.map((op, i) => (
            <OpinionCard key={i} op={op} graph={graph} />
          ))}
        </div>
      </div>
    </>
  );
}

/* --------------------------------- Atoms ---------------------------------- */

function DrawerHeader({
  eyebrow,
  title,
  titleIsArabic,
  onClose,
}: {
  eyebrow: React.ReactNode;
  title: string;
  /** Force the Arabic UI font on the title even when it isn't a number-ref. */
  titleIsArabic?: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="flex items-start justify-between border-b border-hairline px-7 pb-5 pt-7">
      <div className="flex flex-col gap-1.5">
        <span className={`text-[10.5px] uppercase tracking-[0.28em] text-text-faint ${sansForLang}`}>
          {eyebrow}
        </span>
        <h2
          className={`text-[26px] font-medium tracking-tight text-text ${
            titleIsArabic ? "font-arabic" : "font-sans"
          }`}
        >
          {title}
        </h2>
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-text-muted transition hover:border-hairline-strong hover:text-text"
        aria-label={t.drawerClose}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SurahCard({ node }: { node: GraphData["nodes"][string] }) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="mt-5 flex items-center justify-between rounded-lg border border-hairline bg-surface/40 px-4 py-3">
      <div className={`text-[11px] uppercase tracking-[0.26em] text-text-faint ${sansForLang}`}>
        {t.drawerCluster}
      </div>
      <div className={t.isRTL ? "text-left" : "text-right"}>
        <div className="font-quran text-[19px] text-ink-bright" dir="rtl">
          {node.sna}
        </div>
        <div className={`text-[11px] text-text-muted ${sansForLang}`}>
          {t.drawerSurah(node.s, node.sn)}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className={`mt-5 flex items-center gap-4 text-[11.5px] text-text-faint ${sansForLang}`}>
      <span className="uppercase tracking-[0.24em]">{label}</span>
      <span className="text-text-muted">{value}</span>
      {secondary && <span className="text-text-faint">· {secondary}</span>}
    </div>
  );
}

function SectionHeading({ left, right }: { left: string; right?: string }) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="mt-8 flex items-center justify-between border-t border-hairline pt-5">
      <span className={`text-[10.5px] uppercase tracking-[0.32em] text-text-muted ${sansForLang}`}>
        {left}
      </span>
      {right && (
        <span className={`text-[10.5px] uppercase tracking-[0.24em] text-text-faint ${sansForLang}`}>
          {right}
        </span>
      )}
    </div>
  );
}

type VerseLike = NonNullable<ReturnType<typeof useVerse>>["verse"];

function AyahCard({
  side,
  node,
  verse,
  diffMask,
}: {
  side: "A" | "B";
  node: GraphData["nodes"][string];
  verse?: VerseLike;
  diffMask?: Set<number>;
}) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="mt-5 rise">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline-strong font-sans text-[10px] text-ink">
            {side}
          </span>
          <span className="font-sans text-[12px] tracking-wider text-ink">
            {node.s}:{node.a}
          </span>
          <span className={`text-[11px] text-text-faint ${sansForLang}`}>· {node.sn}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10.5px] uppercase tracking-[0.22em] text-text-faint ${sansForLang}`}>
            {t.drawerJuz} {node.j}
          </span>
          <AudioButton url={verse?.audio?.url} />
        </div>
      </div>
      <VerseBody node={node} verse={verse} size={25} diffMask={diffMask} />
    </div>
  );
}

/**
 * Shared verse renderer. Falls back to plain Arabic text when the
 * Quran.com enrichment hasn't loaded (or is disabled / unavailable).
 */
function VerseBody({
  node,
  verse,
  size,
  diffMask,
}: {
  node: GraphData["nodes"][string];
  verse?: VerseLike;
  size: number;
  diffMask?: Set<number>;
}) {
  const s = useSettings();
  const words = verse?.words?.filter((w) => w.charTypeName === "word") ?? [];
  const translation = verse?.translations?.[0];

  return (
    <>
      {s.showWordByWord && words.length > 0 ? (
        <WordTokens words={words} size={size - 3} diffMask={diffMask} />
      ) : (
        <p
          className="font-quran text-text"
          dir="rtl"
          lang="ar"
          style={{ fontSize: size, lineHeight: 2.05 }}
        >
          {node.t}
        </p>
      )}
      {s.showTranslation && <TranslationLine translation={translation} />}
    </>
  );
}

function Divider() {
  return (
    <div className="my-2 flex items-center justify-center">
      <div className="hairline w-12" />
      <span className="mx-3 font-sans text-[10px] uppercase tracking-[0.32em] text-text-faint">
        ⇄
      </span>
      <div className="hairline w-12" />
    </div>
  );
}

function OpinionCard({ op, graph }: { op: Opinion; graph: GraphData }) {
  const book = graph.books[op.bk];
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="rounded-lg border border-hairline bg-surface/40 px-4 py-4 rise">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-quran text-[16px] text-text" dir="rtl">
            {book?.t}
          </div>
          <div className="mt-0.5 font-arabic text-[11.5px] text-text-faint" dir="rtl">
            {book?.a}
          </div>
        </div>
        <CategoryChip cat={op.c} />
      </div>

      {(op.sc || op.r || op.w) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {op.sc && <MicroChip>{prettify(op.sc)}</MicroChip>}
          {op.r && <MicroChip>{prettify(op.r)}</MicroChip>}
          {op.w && (
            <MicroChip>
              <span className="text-text-faint">{t.drawerWajh} </span>
              <span dir="rtl">{op.w}</span>
            </MicroChip>
          )}
        </div>
      )}

      {op.se && (
        <p className="mt-3 font-sans text-[13px] leading-[1.6] text-text">
          {op.se}
        </p>
      )}
      {op.sa && (
        <p
          className="mt-2 font-arabic text-[14px] leading-[1.85] text-text-muted"
          dir="rtl"
        >
          {op.sa}
        </p>
      )}

      {(op.p || op.cf !== undefined) && (
        <div className={`mt-3 flex items-center justify-between border-t border-hairline pt-2 text-[10.5px] text-text-faint ${sansForLang}`}>
          <span>{op.p ?? ""}</span>
          {op.cf !== undefined && (
            <span className="uppercase tracking-[0.22em]">
              {t.drawerConfidence} · {Math.round(op.cf * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ cat }: { cat: Category }) {
  const color = CATEGORY_COLOR[cat];
  const t = useT();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] uppercase tracking-[0.18em] ${
        t.isRTL ? "font-arabic" : "font-sans"
      }`}
      style={{ borderColor: `${color}55`, color, background: `${color}10` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {t.category[cat]}
    </span>
  );
}

function MicroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-hairline bg-ocean px-2 py-0.5 font-sans text-[10.5px] tracking-wide text-text-muted">
      {children}
    </span>
  );
}

function DotsForOpinions({ ops }: { ops: Opinion[] }) {
  const t = useT();
  const cats = Array.from(new Set(ops.map((o) => o.c))).slice(0, 4);
  return (
    <>
      {cats.map((c) => (
        <span
          key={c}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: CATEGORY_COLOR[c], boxShadow: `0 0 4px ${CATEGORY_COLOR[c]}` }}
          title={t.category[c]}
        />
      ))}
    </>
  );
}

function prettify(s: string) {
  return s.replaceAll("_", " ");
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ArrowLeft({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      style={flipped ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M7 2 3 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
