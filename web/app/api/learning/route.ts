// POST /api/learning — recompute this reader's topic weights now (engine /learning/recompute).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${process.env.ENGINE_URL}/learning/recompute`, {
      method: "POST",
      headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "engine_error" }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
