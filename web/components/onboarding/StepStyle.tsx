"use client";
import { labelCls, type OnboardingAnswers, type StepProps } from "./types";

const STYLES: { value: OnboardingAnswers["readingStyle"]; title: string; detail: string; time: string }[] = [
  { value: "quick", title: "Quick", detail: "8 stories, a line or two each", time: "5-minute read" },
  { value: "balanced", title: "Balanced", detail: "11 stories, a short paragraph each", time: "10-minute read" },
  { value: "deep", title: "Deep", detail: "14 stories, fuller summaries", time: "20-minute read" },
];

const REGIONS: { value: OnboardingAnswers["region"]; label: string }[] = [
  { value: "pakistan", label: "Pakistan first" },
  { value: "global", label: "Global" },
  { value: "both", label: "Both" },
];

export default function StepStyle({ answers, setAnswers }: StepProps) {
  return (
    <div>
      <h1 className="font-headline text-4xl font-bold md:text-5xl">How do you like to read?</h1>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {STYLES.map((s) => {
          const on = answers.readingStyle === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={on}
              onClick={() => setAnswers((a) => ({ ...a, readingStyle: s.value }))}
              className={`p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on ? "border-2 border-accent" : "border border-ink/30 hover:border-ink"
              }`}
            >
              <span className={`font-headline text-3xl font-bold ${on ? "text-accent" : ""}`}>{s.title}</span>
              <span className="mt-2 block font-body text-[15px]">{s.detail}</span>
              <span className="mt-3 block font-label text-[11px] uppercase tracking-widest text-muted">{s.time}</span>
            </button>
          );
        })}
      </div>
      <p className={`mt-10 ${labelCls}`}>Region</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {REGIONS.map((r) => {
          const on = answers.region === r.value;
          return (
            <button
              key={r.value}
              type="button"
              aria-pressed={on}
              onClick={() => setAnswers((a) => ({ ...a, region: r.value }))}
              className={`px-4 py-2 font-body ${on ? "bg-accent text-paper" : "border border-ink/30 hover:border-ink"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
