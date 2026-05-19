"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/lib/store";
import { CATEGORY_COLOR, CATEGORY_LABEL, type Category, type Edge, type GraphData, type Opinion } from "@/types/graph";

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
        eyebrow={`Sūrah ${node.s} · ${node.sn}`}
        title={`${node.s}:${node.a}`}
        onClose={onClose}
      />

      <div className="thin-scroll flex-1 overflow-y-auto px-7 pb-12">
        <SurahCard node={node} />

        <div className="rise mt-7">
          <p
            className="font-quran text-[28px] leading-[2.05] text-text"
            dir="rtl"
            lang="ar"
          >
            {node.t}
          </p>
        </div>

        <Meta label="Juzʾ" value={`${node.j}`} secondary={`Hizb ¼ · ${node.hq}`} />

        <SectionHeading
          left="Connections"
          right={`${edges.length} thread${edges.length === 1 ? "" : "s"}`}
        />

        {hiddenCount > 0 && (
          <p className="mt-2 font-sans text-[10.5px] uppercase tracking-[0.22em] text-text-faint">
            {hiddenCount} more outside the active lens
          </p>
        )}
        {edges.length === 0 && (
          <p className="mt-4 rounded-lg border border-hairline bg-surface/40 px-4 py-5 text-center font-sans text-[12.5px] text-text-muted">
            No threads of this kind reach this āyah. Clear the lens to see all {allCount}.
          </p>
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {edges.map(({ idx, edge }) => {
            const otherId = edge.a === id ? edge.b : edge.a;
            const other = graph.nodes[otherId];
            return (
              <li key={idx}>
                <button
                  onClick={() => setEdge([id, otherId])}
                  className="group w-full rounded-lg border border-hairline bg-surface/40 px-4 py-3 text-left transition hover:border-hairline-strong hover:bg-surface/70"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-sans text-[12px] tracking-wider text-ink">
                      {other.s}:{other.a}
                      <span className="ml-2 text-text-faint">{other.sn}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {dotsForOpinions(edge.ops)}
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
            <ArrowLeft />
            <span>Back to {a.s}:{a.a}</span>
          </button>
        }
        title="Comparison"
        onClose={onClose}
      />

      <div className="thin-scroll flex-1 overflow-y-auto px-7 pb-12">
        <div className="mt-2 flex items-center gap-3">
          <CategoryChip cat={edge.pc} />
          <span className="font-sans text-[10.5px] uppercase tracking-[0.24em] text-text-faint">
            {edge.ops.length} scholarly reading{edge.ops.length === 1 ? "" : "s"}
          </span>
        </div>

        <AyahCard side="A" node={a} />
        <Divider />
        <AyahCard side="B" node={b} />

        <SectionHeading left="The readings" right={`${edge.ops.length}`} />

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
  onClose,
}: {
  eyebrow: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between border-b border-hairline px-7 pb-5 pt-7">
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-[10.5px] uppercase tracking-[0.28em] text-text-faint">
          {eyebrow}
        </span>
        <h2 className="font-sans text-[26px] font-medium tracking-tight text-text">{title}</h2>
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-text-muted transition hover:border-hairline-strong hover:text-text"
        aria-label="Close"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SurahCard({ node }: { node: GraphData["nodes"][string] }) {
  return (
    <div className="mt-5 flex items-center justify-between rounded-lg border border-hairline bg-surface/40 px-4 py-3">
      <div className="font-sans text-[11px] uppercase tracking-[0.26em] text-text-faint">
        Cluster
      </div>
      <div className="text-right">
        <div className="font-quran text-[19px] text-ink-bright" dir="rtl">
          {node.sna}
        </div>
        <div className="font-sans text-[11px] text-text-muted">
          Sūrah {node.s} · {node.sn}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  return (
    <div className="mt-5 flex items-center gap-4 font-sans text-[11.5px] text-text-faint">
      <span className="uppercase tracking-[0.24em]">{label}</span>
      <span className="text-text-muted">{value}</span>
      {secondary && <span className="text-text-faint">· {secondary}</span>}
    </div>
  );
}

function SectionHeading({ left, right }: { left: string; right?: string }) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-hairline pt-5">
      <span className="font-sans text-[10.5px] uppercase tracking-[0.32em] text-text-muted">
        {left}
      </span>
      {right && (
        <span className="font-sans text-[10.5px] uppercase tracking-[0.24em] text-text-faint">
          {right}
        </span>
      )}
    </div>
  );
}

function AyahCard({ side, node }: { side: "A" | "B"; node: GraphData["nodes"][string] }) {
  return (
    <div className="mt-5 rise">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline-strong font-sans text-[10px] text-ink">
            {side}
          </span>
          <span className="font-sans text-[12px] tracking-wider text-ink">
            {node.s}:{node.a}
          </span>
          <span className="font-sans text-[11px] text-text-faint">· {node.sn}</span>
        </div>
        <span className="font-sans text-[10.5px] uppercase tracking-[0.22em] text-text-faint">
          Juzʾ {node.j}
        </span>
      </div>
      <p
        className="font-quran text-[25px] leading-[2.05] text-text"
        dir="rtl"
        lang="ar"
      >
        {node.t}
      </p>
    </div>
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
              <span className="text-text-faint">wajh: </span>
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
        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2 font-sans text-[10.5px] text-text-faint">
          <span>{op.p ?? ""}</span>
          {op.cf !== undefined && (
            <span className="uppercase tracking-[0.22em]">
              confidence · {Math.round(op.cf * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ cat }: { cat: Category }) {
  const color = CATEGORY_COLOR[cat];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[10.5px] uppercase tracking-[0.18em]"
      style={{ borderColor: `${color}55`, color, background: `${color}10` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {CATEGORY_LABEL[cat]}
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

function dotsForOpinions(ops: Opinion[]) {
  const cats = Array.from(new Set(ops.map((o) => o.c))).slice(0, 4);
  return cats.map((c) => (
    <span
      key={c}
      className="h-1.5 w-1.5 rounded-full"
      style={{ background: CATEGORY_COLOR[c], boxShadow: `0 0 4px ${CATEGORY_COLOR[c]}` }}
      title={CATEGORY_LABEL[c]}
    />
  ));
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

function ArrowLeft() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M7 2 3 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
