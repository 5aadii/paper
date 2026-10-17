// GET /api/cron — daily morning run (SPEC Section 8.11). Vercel Cron calls this with
// "Authorization: Bearer <CRON_SECRET>" (see vercel.json); it asks the engine to print every reader's paper.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const res = await fetch(`${process.env.ENGINE_URL}/editions/generate-all`, {
      method: "POST",
      headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "" },
      cache: "no-store",
    });
    return NextResponse.json({ queued: res.ok }, { status: res.ok ? 202 : 503 });
  } catch {
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
