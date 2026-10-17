// "What your paper knows about you" — the learning made visible (SPEC Section 8.10).
import Link from "next/link";
import { redirect } from "next/navigation";
import InterestsPanel, { type InterestRow } from "@/components/InterestsPanel";
import { topicLabel } from "@/lib/topics";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your interests · The Morning Edition" };

type Ev = { topic: string | null; source_name: string | null; event_type: string; value: number | null; created_at: string };

/** ISO timestamp for 7 days ago (computed per request, outside render logic). */
function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

function minutes(sec: number) {
  return sec < 60 ? `${Math.round(sec)} sec` : `${Math.round(sec / 60)} min`;
}

export default async function InterestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const since = weekAgoIso();
  const [{ data: interests }, { data: events }] = await Promise.all([
    supabase.from("interests").select("id, topic, label, kind, base_weight, weight, previous_weight").eq("user_id", user.id),
    supabase
      .from("events")
      .select("topic, source_name, event_type, value, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .limit(5000),
  ]);
  const ev = (events ?? []) as Ev[];

  const opens = ev.filter((e) => e.event_type === "open");
  const reads = ev.filter((e) => e.event_type === "read_time");
  const totalSec = reads.reduce((s, e) => s + (e.value ?? 0), 0);
  const byTopic = new Map<string, { opens: number; sec: number }>();
  const bySource = new Map<string, number>();
  for (const e of ev) {
    if (e.topic) {
      const t = byTopic.get(e.topic) ?? { opens: 0, sec: 0 };
      if (e.event_type === "open") t.opens += 1;
      if (e.event_type === "read_time") t.sec += e.value ?? 0;
      byTopic.set(e.topic, t);
    }
    if (e.source_name && e.event_type === "read_time") {
      bySource.set(e.source_name, (bySource.get(e.source_name) ?? 0) + (e.value ?? 0));
    }
  }
  const topTopic = [...byTopic.entries()].sort((a, b) => b[1].sec - a[1].sec)[0];
  const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  const stats: [string, string][] = [
    ["Stories opened", String(opens.length)],
    ["Total reading time", minutes(totalSec)],
    ["Average per story", reads.length ? minutes(totalSec / reads.length) : "—"],
    ["Most-read section", topTopic && topTopic[1].sec > 0 ? topicLabel(topTopic[0]) : "—"],
    ["Most-read source", topSource ? topSource[0] : "—"],
    ["Likes · Skips", `${ev.filter((e) => e.event_type === "like").length} · ${ev.filter((e) => e.event_type === "skip").length}`],
  ];
  const perTopic = [...byTopic.entries()]
    .filter(([, t]) => t.opens > 0 || t.sec > 0)
    .sort((a, b) => b[1].sec - a[1].sec)
    .slice(0, 8);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between border-b border-rule pb-2 font-label text-[11px] uppercase tracking-widest">
        <Link href="/today" className="hover:text-accent">‹ Today&rsquo;s paper</Link>
        <Link href="/archive" className="hover:text-accent">Archive</Link>
      </div>
      <h1 className="mt-8 font-headline text-4xl font-black md:text-5xl">What your paper knows about you</h1>
      <p className="mt-3 max-w-2xl font-body text-lg italic text-muted">
        Your paper adjusts these every morning based on which headlines you open, how long you actually read, and what you
        like or skip.
      </p>

      <section className="mt-8 border-t-[3px] border-rule pt-3">
        <h2 className="font-label text-[11px] font-bold uppercase tracking-widest">Your reading this week</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k} className="border-l-2 border-accent pl-3">
              <dt className="font-label text-[10px] uppercase tracking-widest text-muted">{k}</dt>
              <dd className="font-headline text-2xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {perTopic.length > 0 && (
          <ul className="mt-5 space-y-1 font-body text-[16px]">
            {perTopic.map(([t, s]) => (
              <li key={t}>
                <span className="font-bold">{topicLabel(t)}</span> — {s.opens} {s.opens === 1 ? "story" : "stories"} opened,{" "}
                {minutes(s.sec)} read
              </li>
            ))}
          </ul>
        )}
      </section>

      <InterestsPanel initial={(interests ?? []) as InterestRow[]} userId={user.id} />
    </main>
  );
}
