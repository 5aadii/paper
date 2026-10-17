"use client";
// One-click follow for topics the reader doesn't follow yet (adds an interest row).
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FollowTopics({ userId, topics }: { userId: string; topics: { slug: string; label: string }[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function follow(slug: string, label: string) {
    setDone((d) => new Set(d).add(slug));
    const { error } = await createClient()
      .from("interests")
      .upsert({ user_id: userId, topic: slug, label, kind: "topic", base_weight: 1, weight: 1 }, { onConflict: "user_id,topic" });
    if (error) {
      setError("Could not follow that topic.");
      setDone((d) => {
        const n = new Set(d);
        n.delete(slug);
        return n;
      });
    }
  }

  if (!topics.length) return <p className="py-4 font-body italic text-muted">You follow every topic. Impressive.</p>;
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {topics.map((t) => {
          const on = done.has(t.slug);
          return (
            <button
              key={t.slug}
              type="button"
              disabled={on}
              onClick={() => follow(t.slug, t.label)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body ${on ? "bg-accent text-paper" : "border border-ink hover:bg-ink hover:text-paper"}`}
            >
              {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />} {t.label}
            </button>
          );
        })}
      </div>
      {done.size > 0 && <p className="mt-3 font-body text-sm text-muted">Followed — these topics join your next edition.</p>}
      {error && <p className="mt-2 font-body text-sm text-accent">{error}</p>}
    </>
  );
}
