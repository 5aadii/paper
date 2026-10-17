export type OnboardingAnswers = {
  displayName: string;
  paperName: string;
  topics: { slug: string; label: string; level: 1 | 2 }[];
  customPhrases: string[];
  readingStyle: "quick" | "balanced" | "deep";
  region: "pakistan" | "global" | "both";
};

export type StepProps = {
  answers: OnboardingAnswers;
  setAnswers: (fn: (a: OnboardingAnswers) => OnboardingAnswers) => void;
};

export const labelCls = "block font-label text-[11px] uppercase tracking-widest text-muted";
export const inputCls =
  "mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-xl outline-none focus:border-accent";
export const chipCls =
  "border border-ink px-3 py-1.5 font-body text-sm hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
