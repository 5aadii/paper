// POST /api/generate — asks the engine to print today's paper (SPEC Section 8.8).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // empty body is fine
  }

  try {
    const res = await fetch(`${process.env.ENGINE_URL}/editions/generate`, {
      method: "POST",
      headers: {
        "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: user.id, force }),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "engine_error" }, { status: res.status === 401 ? 500 : 503 });
    }
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
