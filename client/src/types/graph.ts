/** Slim graph types, mirroring scripts/build_graph_data.py output. */

export type Category =
  | "structural"
  | "semantic"
  | "doctrinal"
  | "lexical"
  | "cross_surah_refrain"
  | "thematic"
  | "";

export type Book = {
  /** Arabic title */
  t: string;
  /** Short author label */
  a: string;
};

export type Node = {
  /** surah number */
  s: number;
  /** ayah number */
  a: number;
  /** surah name English */
  sn: string;
  /** surah name Arabic */
  sna: string;
  /** uthmani text */
  t: string;
  j: number;
  hq: number;
  /** linear ayah number 1..6236 */
  n: number;
  /** indices into edges[] */
  e: number[];
};

export type Opinion = {
  /** index into books[] */
  bk: number;
  c: Category;
  sc?: string;
  r?: string;
  w?: string;
  /** summary Arabic */
  sa?: string;
  /** summary English */
  se?: string;
  cf?: number;
  /** source page citation */
  p?: string;
};

export type Edge = {
  /** node id "s:a", lower lex */
  a: string;
  /** node id "s:a", higher lex */
  b: string;
  ops: Opinion[];
  /** dominant category across opinions */
  pc: Category;
  /** opinion count (weight) */
  w: number;
};

export type GraphData = {
  meta: { nodes: number; edges: number; books: number };
  books: Book[];
  nodes: Record<string, Node>;
  edges: Edge[];
};

export const CATEGORY_LABEL: Record<Category, string> = {
  structural: "Structural",
  semantic: "Semantic",
  doctrinal: "Doctrinal",
  lexical: "Lexical",
  cross_surah_refrain: "Refrain",
  thematic: "Thematic",
  "": "Other",
};

/**
 * Category color tokens — used by both the 3D scene (hex strings) and UI chips.
 * Tuned to read against the deep-ocean background.
 */
export const CATEGORY_COLOR: Record<Category, string> = {
  structural: "#d4af37", // golden ink — the dominant category
  semantic: "#9ec5ff",
  doctrinal: "#e08a5b",
  lexical: "#7adfbb",
  cross_surah_refrain: "#c89cff",
  thematic: "#f5d97a",
  "": "#94a3b8",
};
