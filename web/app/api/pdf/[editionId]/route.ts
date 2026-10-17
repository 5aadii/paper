// GET /api/pdf/[editionId] — streams the newspaper PDF from the engine (SPEC Section 8.8).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/[editionId]">) {
  const { editionId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS guarantees this only finds the reader's own edition.
  const { data: edition } = await supabase
    .from("editions")
    .select("id, edition_date, status")
    .eq("id", editionId)
    .maybeSingle();
  if (!edition || edition.status !== "ready") return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const res = await fetch(
      `${process.env.ENGINE_URL}/editions/${encodeURIComponent(editionId)}/pdf?user_id=${encodeURIComponent(user.id)}`,
      { headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "" }, cache: "no-store" },
    );
    if (!res.ok || !res.body) return NextResponse.json({ error: "pdf_unavailable" }, { status: 503 });
    return new Response(res.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="morning-edition-${edition.edition_date}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
