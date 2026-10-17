// POST /api/events — validates and stores one learning event (SPEC Section 8.8).
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = new Set(["open", "read_time", "click_through", "like", "dislike", "skip", "quiz_correct", "quiz_wrong"]);
// Events that say something about interest. After each one, the reader's topic weights are
// recomputed in the background, so the paper learns as they read (like a social feed does).
const LEARNS = new Set(["read_time", "click_through", "like", "dislike", "skip", "quiz_correct"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.length ? v.slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response(null, { status: 401 });

    const b = await request.json();
    if (!TYPES.has(b?.type) || !UUID.test(b?.editionId ?? "") || !UUID.test(b?.itemId ?? "")) {
      return new Response(null, { status: 400 });
    }
    let value: number | null = null;
    if (b.type === "read_time") {
      const n = Number(b.value);
      if (!Number.isFinite(n)) return new Response(null, { status: 400 });
      value = Math.max(0, Math.min(600, Math.round(n)));
    }

    await supabase.from("events").insert({
      user_id: user.id,
      edition_id: b.editionId,
      item_id: b.itemId,
      topic: str(b.topic),
      source_name: str(b.sourceName),
      event_type: b.type,
      value,
    });
    if (LEARNS.has(b.type)) {
      const userId = user.id;
      after(async () => {
        try {
          await fetch(`${process.env.ENGINE_URL}/learning/recompute`, {
            method: "POST",
            headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "", "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, live: true }),
            cache: "no-store",
          });
        } catch {
          // the next edition recomputes anyway
        }
      });
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
