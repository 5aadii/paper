"use client";
import { Check, Star } from "lucide-react";
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
  const picked = answers.topics.length;
  const loved = answers.topics.filter((t) => t.level === 2).length;

  return (
    <div>
      <h1 className="font-headline text-4xl font-bold md:text-5xl">What do you care about?</h1>
      <p className="mt-2 font-body text-lg text-muted">Pick at least three. Your front page is built around them.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-rule py-2 font-label text-xs uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 border-2 border-accent" /> Tap once · Interested</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-accent text-paper"><Star size={9} fill="currentColor" /></span> Tap twice · Love it (double weight)</span>
        <span className="text-muted">Tap again · Remove</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map(({ slug, label, icon: Icon, blurb }) => {
          const l = level(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => tap(slug, label)}
              aria-pressed={l > 0}
              aria-label={`${label}${l === 2 ? ", love it" : l === 1 ? ", interested" : ""}`}
              className={`group relative flex items-start gap-3 p-3 text-left transition-all duration-150 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                l === 2
                  ? "bg-accent text-paper shadow-[3px_3px_0_0_#1a1a1a]"
                  : l === 1
                    ? "border-2 border-accent bg-paper"
                    : "border border-ink/25 hover:border-ink hover:shadow-[2px_2px_0_0_#1a1a1a]"
              }`}
            >
              <Icon size={22} strokeWidth={1.6} className={`mt-0.5 shrink-0 ${l === 1 ? "text-accent" : ""}`} aria-hidden />
              <span className="min-w-0">
                <span className="block font-headline text-[17px] font-bold leading-tight">{label}</span>
                <span className={`mt-0.5 block font-body text-[13px] leading-snug ${l === 2 ? "text-paper/85" : "text-muted"}`}>{blurb}</span>
              </span>
              {l === 1 && <Check size={14} className="absolute right-2 top-2 text-accent" aria-hidden />}
              {l === 2 && <Star size={14} fill="currentColor" className="absolute right-2 top-2" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-label text-xs uppercase tracking-widest" aria-live="polite">
        <span className={picked >= 3 ? "text-ink" : "text-accent"}>{picked} picked</span> · {loved} loved
        {picked < 3 && <span className="text-muted"> — pick {3 - picked} more</span>}
      </p>
    </div>
  );
}
