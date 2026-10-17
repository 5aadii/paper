"use client";
// Onboarding: 4 steps on one page (SPEC Section 8.4).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProgressBar from "@/components/onboarding/ProgressBar";
import StepName from "@/components/onboarding/StepName";
import StepSpecific from "@/components/onboarding/StepSpecific";
import StepStyle from "@/components/onboarding/StepStyle";
import StepTopics from "@/components/onboarding/StepTopics";
import type { OnboardingAnswers } from "@/components/onboarding/types";
import { createClient } from "@/lib/supabase/client";

const TOTAL = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswersState] = useState<OnboardingAnswers>({
    displayName: "",
    paperName: "",
    topics: [],
    customPhrases: [],
    readingStyle: "balanced",
    region: "both",
  });
  const setAnswers = (fn: (a: OnboardingAnswers) => OnboardingAnswers) => setAnswersState(fn);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      const meta = data.user.user_metadata ?? {};
      const full = (p?.display_name || meta.display_name || meta.given_name || meta.full_name || meta.name || "") as string;
      const name = full.split(" ")[0];
      if (name) setAnswersState((a) => (a.displayName ? a : { ...a, displayName: name }));
    });
  }, []);

  const canNext = step === 0 ? answers.displayName.trim().length > 0 : step === 1 ? answers.topics.length >= 3 : true;

  async function onFinish(a: OnboardingAnswers) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Please log in again.");
      const name = a.displayName.trim();
      const paperName = a.paperName.trim() || `The ${name} Chronicle`;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ display_name: name, paper_name: paperName, reading_style: a.readingStyle, region: a.region, onboarded: true })
        .eq("id", user.id);
      if (pErr) throw pErr;

      await supabase.from("interests").delete().eq("user_id", user.id);
      const rows = [
        ...a.topics.map((t) => ({
          user_id: user.id, topic: t.slug, label: t.label, kind: "topic",
          base_weight: t.level === 2 ? 2.0 : 1.0, weight: t.level === 2 ? 2.0 : 1.0,
        })),
        ...a.customPhrases.map((p) => ({
          user_id: user.id, topic: `custom:${p.toLowerCase()}`, label: p, kind: "custom",
          base_weight: 1.5, weight: 1.5,
        })),
      ];
      const { error: iErr } = await supabase.from("interests").insert(rows);
      if (iErr) throw iErr;

      await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      }).catch(() => null);
      router.replace("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      setBusy(false);
    }
  }

  function next() {
    if (!canNext || busy) return;
    if (step < TOTAL - 1) setStep(step + 1);
    else void onFinish(answers);
  }

  return (
    <main
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-28 pt-8"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          next();
        }
      }}
    >
      <p className="mb-3 text-center font-masthead text-xl font-bold">The Morning Edition</p>
      <ProgressBar step={step} total={TOTAL} />
      <div key={step} className="mt-8 animate-[fadein_.25s_ease-out]">
        {step === 0 && <StepName answers={answers} setAnswers={setAnswers} />}
        {step === 1 && <StepTopics answers={answers} setAnswers={setAnswers} />}
        {step === 2 && <StepSpecific answers={answers} setAnswers={setAnswers} />}
        {step === 3 && <StepStyle answers={answers} setAnswers={setAnswers} />}
      </div>
      {error && <p className="mt-6 font-body text-accent">{error}</p>}
      <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            className={`font-label text-xs uppercase tracking-widest ${step === 0 ? "invisible" : ""}`}
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            {step === 2 && answers.customPhrases.length === 0 && (
              <button type="button" onClick={() => setStep(3)} className="font-label text-xs uppercase tracking-widest text-muted">
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!canNext || busy}
              className="btn btn-primary disabled:opacity-40"
            >
              {busy ? "Printing…" : step === TOTAL - 1 ? "Print my paper" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
