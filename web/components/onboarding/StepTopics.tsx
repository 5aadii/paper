"use client";
import { Star } from "lucide-react";
import { TOPICS } from "@/lib/topics";
import type { StepProps } from "./types";

export default function StepTopics({ answers, setAnswers }: StepProps) {
  const level = (slug: string) => answers.topics.find((t) => t.slug === slug)?.level ?? 0;

  function tap(slug: string, label: string) {
    setAnswers((a) => {
      const cur = a.topics.find((t) => t.slug === slug);
      if (!cur) return { ...a, topics: [...a.topics, { slug, label, level: 1 }] };
      if (cur.level === 1) return { ...a, topics: a.topics.map((t) => (t.slug === slug ? { ...t, level: 2 } : t)) };
      return { ...a, topics: a.topics.filter((t) => t.slug !== slug) };
    });
  }

  return (
    <div>
      <h1 className="font-headline text-4xl font-bold md:text-5xl">What do you care about?</h1>
      <p className="mt-2 font-body text-lg text-muted">
        Tap twice for the things you love. Pick at least 3.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TOPICS.map(({ slug, label, icon: Icon }) => {
          const l = level(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => tap(slug, label)}
              aria-pressed={l > 0}
              aria-label={`${label}${l === 2 ? ", love it" : l === 1 ? ", interested" : ""}`}
              className={`relative flex items-center gap-2 px-3 py-3 text-left font-body text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                l === 2
                  ? "border border-accent bg-accent text-paper"
                  : l === 1
                    ? "border-2 border-accent text-accent"
                    : "border border-ink/30 hover:border-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              <span className="leading-tight">{label}</span>
              {l === 2 && <Star size={13} fill="currentColor" className="absolute right-2 top-2" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-label text-[11px] uppercase tracking-widest text-muted">
        {answers.topics.length} picked · {answers.topics.filter((t) => t.level === 2).length} loved
      </p>
    </div>
  );
}
