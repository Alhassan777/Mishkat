import { NextResponse } from "next/server";
import { callUserApi } from "@/lib/quran/user-server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/bookmarks/[id] — remove a saved āyah by its QF bookmark id.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // We have to go through the collection endpoint — the standalone
  // /auth/v1/bookmarks/{id} delete won't detach items from the default
  // Favorites collection (it just clears isReading), so saves persist.
  const r = await callUserApi(
    `/auth/v1/collections/__default__/bookmarks/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (r.kind === "unauthorized") {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const res = r.response;
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Upstream ${res.status}: ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
