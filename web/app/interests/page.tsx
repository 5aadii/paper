// "What your paper knows about you" — the learning made visible (SPEC Section 8.10).
import Link from "next/link";
import { redirect } from "next/navigation";
import InterestsPanel, { type InterestRow } from "@/components/InterestsPanel";
import { topicLabel } from "@/lib/topics";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your interests · The Morning Edition" };

type Ev = { topic: string | null; source_name: string | null; event_type: string; value: number | null; created_at: string };

/** ISO timestamp for 7 days ago (computed per request, outside render logic). */
function lastSevenDays(): { key: string; label: string; sec: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "short" }), sec: 0 };
  });
}

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

function monthAgoIso(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
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
  const [{ data: interests }, { data: events }, { data: monthEvents }] = await Promise.all([
    supabase.from("interests").select("id, topic, label, kind, base_weight, weight, previous_weight").eq("user_id", user.id),
    supabase
      .from("events")
      .select("topic, source_name, event_type, value, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .limit(5000),
    supabase
      .from("events")
      .select("topic, event_type, value")
      .eq("user_id", user.id)
      .gte("created_at", monthAgoIso())
      .limit(10000),
  ]);

  // Plain-language reason for each weight, from the reader's real events in the last 30 days.
  const month = new Map<string, { open: number; sec: number; like: number; dislike: number; skip: number; click: number }>();
  for (const e of (monthEvents ?? []) as Ev[]) {
    if (!e.topic) continue;
    const m = month.get(e.topic) ?? { open: 0, sec: 0, like: 0, dislike: 0, skip: 0, click: 0 };
    if (e.event_type === "open") m.open++;
    if (e.event_type === "read_time") m.sec += e.value ?? 0;
    if (e.event_type === "like") m.like++;
    if (e.event_type === "dislike") m.dislike++;
    if (e.event_type === "skip") m.skip++;
    if (e.event_type === "click_through") m.click++;
    month.set(e.topic, m);
  }
  const why: Record<string, string> = {};
  for (const [topic, m] of month) {
    const bits = [
      m.open && `opened ${m.open} ${m.open === 1 ? "story" : "stories"}`,
      m.sec > 0 && `read for ${minutes(m.sec)}`,
      m.click && `went to the original ${m.click}×`,
      m.like && `liked ${m.like}`,
      m.dislike && `disliked ${m.dislike}`,
      m.skip && `skipped ${m.skip}`,
    ].filter(Boolean);
    if (bits.length) why[topic] = `In the last 30 days you ${bits.join(", ")}.`;
  }
  const historyCount = (monthEvents ?? []).length;
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
  // Minutes read per day for the last 7 days (the bar chart).
  const days = lastSevenDays();
  for (const e of reads) {
    const day = days.find((d) => d.key === (e.created_at ?? "").slice(0, 10));
    if (day) day.sec += e.value ?? 0;
  }
  const maxDay = Math.max(60, ...days.map((d) => d.sec));
  const perTopic = [...byTopic.entries()]
    .filter(([, t]) => t.opens > 0 || t.sec > 0)
    .sort((a, b) => b[1].sec - a[1].sec)
    .slice(0, 8);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between border-b border-rule pb-2 font-label text-xs uppercase tracking-widest">
        <Link href="/today" className="hover:text-accent">‹ Today&rsquo;s paper</Link>
        <Link href="/archive" className="hover:text-accent">Archive</Link>
      </div>
      <h1 className="mt-8 font-headline text-4xl font-semibold md:text-5xl">What your paper knows about you</h1>
      <p className="mt-3 max-w-2xl font-body text-lg italic text-muted">
        Your paper adjusts these every morning based on which headlines you open, how long you actually read, and what you
        like or skip.
      </p>

      <section className="mt-8 border-t-[3px] border-rule-strong pt-3">
        <h2 className="font-label text-xs font-bold uppercase tracking-widest">Your reading this week</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k} className="border-l-2 border-accent pl-3">
              <dt className="font-label text-xs uppercase tracking-widest text-muted">{k}</dt>
              <dd className="font-headline text-2xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <figure>
            <figcaption className="font-label text-xs font-bold uppercase tracking-widest">Minutes read, last 7 days</figcaption>
            <div className="mt-3 flex h-40 items-end gap-2 border-b border-rule-strong" role="img"
              aria-label={days.map((d) => `${d.label} ${Math.round(d.sec / 60)} min`).join(", ")}>
              {days.map((d) => (
                <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="font-label text-xs text-muted">{d.sec >= 60 ? Math.round(d.sec / 60) : d.sec > 0 ? "<1" : ""}</span>
                  <div className="w-full max-w-10 bg-accent" style={{ height: `${(d.sec / maxDay) * 100}%`, minHeight: d.sec ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-2">
              {days.map((d) => (
                <span key={d.key} className="flex-1 text-center font-label text-xs text-muted">{d.label}</span>
              ))}
            </div>
          </figure>
          {perTopic.length > 0 && (
            <figure>
              <figcaption className="font-label text-xs font-bold uppercase tracking-widest">Where your reading time went</figcaption>
              <ul className="mt-3 space-y-2.5">
                {perTopic.map(([t, s]) => {
                  const top = Math.max(1, perTopic[0][1].sec);
                  return (
                    <li key={t}>
                      <div className="flex items-baseline justify-between gap-3 font-body text-[15px]">
                        <span className="font-semibold">{topicLabel(t)}</span>
                        <span className="font-label text-xs text-muted">
                          {s.opens} opened · {minutes(s.sec)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 bg-wash">
                        <div className="h-full bg-ink" style={{ width: `${(s.sec / top) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </figure>
          )}
        </div>
      </section>

      <InterestsPanel initial={(interests ?? []) as InterestRow[]} userId={user.id} why={why} historyCount={historyCount} />
    </main>
  );
}
