"use client";
// Weight bars with ▲/▼ change, badges and simple controls for /interests (SPEC Section 8.10).
import { Star, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { topicLabel } from "@/lib/topics";

export type InterestRow = {
  id: string;
  topic: string;
  label: string;
  kind: "topic" | "custom" | "learned";
  base_weight: number;
  weight: number;
  previous_weight: number | null;
};

const BADGE: Record<InterestRow["kind"], string> = {
  topic: "Picked by you",
  custom: "Your phrase",
  learned: "Learned from your reading",
};

export default function InterestsPanel({ initial, userId }: { initial: InterestRow[]; userId: string }) {
  const [rows, setRows] = useState(initial);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const sorted = [...rows].sort((a, b) => b.weight - a.weight);

  async function remove(r: InterestRow) {
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    const { error } = await supabase.from("interests").delete().eq("id", r.id);
    if (error) setError("Could not remove that interest.");
  }

  async function toggleLove(r: InterestRow) {
    const base = r.base_weight >= 2 ? 1 : 2;
    const weight = Math.max(0.1, Math.min(3, r.weight + (base - r.base_weight)));
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, base_weight: base, weight } : x)));
    const { error } = await supabase.from("interests").update({ base_weight: base, weight }).eq("id", r.id);
    if (error) setError("Could not save that change.");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const p = phrase.trim().slice(0, 40);
    if (!p) return;
    const topic = `custom:${p.toLowerCase()}`;
    if (rows.some((r) => r.topic === topic)) return setPhrase("");
    const { data, error } = await supabase
      .from("interests")
      .insert({ user_id: userId, topic, label: p, kind: "custom", base_weight: 1.5, weight: 1.5 })
      .select("id, topic, label, kind, base_weight, weight, previous_weight")
      .single();
    if (error || !data) return setError("Could not add that phrase.");
    setRows((rs) => [...rs, data as InterestRow]);
    setPhrase("");
  }

  return (
    <section className="mt-10 border-t-[3px] border-rule pt-3">
      <h2 className="font-label text-[11px] font-bold uppercase tracking-widest">Your interests, by weight</h2>
      {error && <p className="mt-2 font-body text-accent">{error}</p>}
      <ul className="mt-3 divide-y divide-ink/20">
        {sorted.map((r) => {
          const delta = r.previous_weight == null ? null : r.weight - r.previous_weight;
          return (
            <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 md:grid-cols-[220px_1fr_auto]">
              <div>
                <p className="font-headline text-lg font-bold leading-tight">
                  {r.kind === "custom" ? r.label : topicLabel(r.topic) || r.label}
                </p>
                <p className="font-label text-[10px] uppercase tracking-widest text-muted">{BADGE[r.kind]}</p>
              </div>
              <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                <div className="h-3 flex-1 bg-ink/10" aria-hidden>
                  <div className="h-full bg-ink" style={{ width: `${(Math.min(3, r.weight) / 3) * 100}%` }} />
                </div>
                <span className="w-10 text-right font-label text-xs">{r.weight.toFixed(1)}</span>
                <span
                  className={`w-14 font-label text-xs ${
                    delta == null || Math.abs(delta) < 0.05 ? "text-muted" : delta > 0 ? "text-green-800" : "text-accent"
                  }`}
                >
                  {delta == null || Math.abs(delta) < 0.05 ? "—" : `${delta > 0 ? "▲ +" : "▼ "}${delta.toFixed(1)}`}
                </span>
              </div>
              <div className="col-start-2 row-start-1 flex items-center gap-2 md:col-start-3">
                {r.kind === "topic" && (
                  <button
                    type="button"
                    onClick={() => toggleLove(r)}
                    className={`inline-flex items-center gap-1 border px-2 py-1 font-label text-[10px] uppercase tracking-widest ${
                      r.base_weight >= 2 ? "border-accent bg-accent text-paper" : "border-ink"
                    }`}
                  >
                    {r.base_weight >= 2 && <Star size={10} fill="currentColor" aria-hidden />}
                    {r.base_weight >= 2 ? "Love it" : "Interested"}
                  </button>
                )}
                <button type="button" aria-label={`Remove ${r.label}`} onClick={() => remove(r)} className="p-1 text-muted hover:text-accent">
                  <X size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="mt-6 flex gap-2">
        <input
          value={phrase}
          maxLength={40}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Add a phrase, e.g. PSL"
          className="flex-1 border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent"
        />
        <button type="submit" className="bg-accent px-4 font-label text-xs font-semibold uppercase tracking-widest text-paper">
          Add
        </button>
      </form>
    </section>
  );
}
