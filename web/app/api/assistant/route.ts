// POST /api/assistant — News Assistant search, proxied to the engine with the service key.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let query = "";
  try {
    query = String((await request.json())?.query ?? "").trim().slice(0, 300);
  } catch {
    /* ignore */
  }
  if (!query) return NextResponse.json({ error: "empty_query" }, { status: 400 });

  try {
    const res = await fetch(`${process.env.ENGINE_URL}/assistant/search`, {
      method: "POST",
      headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "engine_error" }, { status: 503 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
