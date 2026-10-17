"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { SUGGESTIONS } from "@/lib/topics";
import { chipCls, inputCls, labelCls, type StepProps } from "./types";

export default function StepSpecific({ answers, setAnswers }: StepProps) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const phrase = raw.trim().slice(0, 40);
    if (!phrase) return;
    setAnswers((a) =>
      a.customPhrases.length >= 8 || a.customPhrases.some((p) => p.toLowerCase() === phrase.toLowerCase())
        ? a
        : { ...a, customPhrases: [...a.customPhrases, phrase] },
    );
    setText("");
  }

  const suggestions = Array.from(new Set(answers.topics.flatMap((t) => SUGGESTIONS[t.slug] ?? [])))
    .filter((s) => !answers.customPhrases.some((p) => p.toLowerCase() === s.toLowerCase()))
    .slice(0, 9);

  return (
    <div>
      <h1 className="font-headline text-4xl font-bold md:text-5xl">Anything specific?</h1>
      <p className="mt-2 font-body text-lg text-muted">A team, a company, a city — we&rsquo;ll watch for it. Optional.</p>
      <label className={`mt-8 ${labelCls}`}>
        Type a phrase and press Enter
        <input
          className={inputCls}
          value={text}
          maxLength={40}
          autoFocus
          placeholder="e.g. Pakistan cricket team"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              e.stopPropagation();
              add(text);
            }
          }}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {answers.customPhrases.map((p) => (
          <span key={p} className="flex items-center gap-1 bg-accent px-3 py-1.5 font-body text-sm text-paper">
            {p}
            <button
              type="button"
              aria-label={`Remove ${p}`}
              onClick={() => setAnswers((a) => ({ ...a, customPhrases: a.customPhrases.filter((x) => x !== p) }))}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      {suggestions.length > 0 && (
        <>
          <p className={`mt-8 ${labelCls}`}>Suggestions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" className={chipCls} onClick={() => add(s)}>
                + {s}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="mt-4 font-label text-[11px] uppercase tracking-widest text-muted">{answers.customPhrases.length}/8</p>
    </div>
  );
}
