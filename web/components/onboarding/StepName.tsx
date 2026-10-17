"use client";
import MastheadPreview from "./MastheadPreview";
import { chipCls, inputCls, labelCls, type StepProps } from "./types";

export default function StepName({ answers, setAnswers }: StepProps) {
  const n = answers.displayName.trim() || "Your";
  const suggestions = [`The ${n} Times`, `The Daily ${n}`, `${n}'s Morning Post`];
  return (
    <div>
      <h1 className="font-headline text-4xl font-bold md:text-5xl">Name your paper</h1>
      <p className="mt-2 font-body text-lg text-muted">Every great paper starts with a masthead.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <label className={labelCls}>
          What should we call you?
          <input
            className={inputCls}
            value={answers.displayName}
            maxLength={40}
            autoFocus
            onChange={(e) => setAnswers((a) => ({ ...a, displayName: e.target.value }))}
          />
        </label>
        <label className={labelCls}>
          Name your paper
          <input
            className={inputCls}
            value={answers.paperName}
            maxLength={48}
            placeholder={`The ${n} Chronicle`}
            onChange={(e) => setAnswers((a) => ({ ...a, paperName: e.target.value }))}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" className={chipCls} onClick={() => setAnswers((a) => ({ ...a, paperName: s }))}>
            {s}
          </button>
        ))}
      </div>
      <MastheadPreview paperName={answers.paperName || `The ${n} Chronicle`} readerName={answers.displayName} />
    </div>
  );
}
