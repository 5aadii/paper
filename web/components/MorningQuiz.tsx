"use client";
// Morning quiz (SPEC Section 9.5): "Test yourself" on today's Three Things.
// Built from the edition itself — each of the Three Things is matched to the headline it came from,
// with two other headlines from today's paper as wrong answers. No extra AI call, so it always works.
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { logEvent } from "@/lib/events";
import type { Edition, EditionItem } from "@/lib/edition";

type Question = { prompt: string; item: EditionItem; options: EditionItem[] };

/** Small seeded shuffle so the server and browser render the same order. */
function shuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function MorningQuiz({ edition }: { edition: Edition }) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const questions = useMemo<Question[]>(() => {
    const items = edition.sections.flatMap((s) => s.items);
    const byId = new Map(items.map((i) => [i.item_id, i]));
    return edition.three_things.slice(0, 3).flatMap((t, qi) => {
      const item = byId.get(t.item_id);
      if (!item) return [];
      const others = shuffle(items.filter((i) => i.item_id !== item.item_id), `${edition.edition_id}-${qi}`).slice(0, 2);
      if (others.length < 2) return [];
      return [{ prompt: t.text, item, options: shuffle([item, ...others], `${t.item_id}-opts`) }];
    });
  }, [edition]);

  if (questions.length === 0) return null;
  const done = Object.keys(answers).length === questions.length;
  const score = questions.filter((q, i) => answers[i] === q.item.item_id).length;

  function answer(qi: number, q: Question, choice: EditionItem) {
    if (answers[qi]) return;
    setAnswers((a) => ({ ...a, [qi]: choice.item_id }));
    logEvent({
      editionId: edition.edition_id,
      itemId: q.item.item_id,
      topic: q.item.topic,
      sourceName: q.item.source_name,
      type: choice.item_id === q.item.item_id ? "quiz_correct" : "quiz_wrong",
    });
  }

  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="btn btn-glass w-full"
      >
        Test yourself · {questions.length} quick questions
      </button>
    );
  }

  return (
    <section aria-label="Morning quiz" className="border-t-[3px] border-rule-strong pt-2">
      <h3 className="font-label text-xs font-bold uppercase tracking-[0.14em]">Morning quiz</h3>
      <ol className="mt-3 space-y-5">
        {questions.map((q, qi) => {
          const picked = answers[qi];
          return (
            <li key={qi}>
              <p className="font-body text-[16px] leading-snug">
                <span className="font-semibold">{qi + 1}.</span> Which story told you this? &ldquo;{q.prompt}&rdquo;
              </p>
              <div className="mt-2 space-y-1.5">
                {q.options.map((o) => {
                  const correct = o.item_id === q.item.item_id;
                  const state = !picked ? "" : correct ? "border-[#2e7d32] bg-[#2e7d32]/10" : picked === o.item_id ? "border-[#c62828] bg-[#c62828]/10" : "opacity-60";
                  return (
                    <button
                      key={o.item_id}
                      type="button"
                      disabled={!!picked}
                      onClick={() => answer(qi, q, o)}
                      className={`flex w-full items-start gap-2 border border-rule px-3 py-2 text-left font-headline text-[15px] leading-snug hover:border-ink disabled:cursor-default ${state}`}
                    >
                      {picked && correct && <Check size={15} className="mt-0.5 shrink-0 text-[#2e7d32]" aria-label="Correct" />}
                      {picked && !correct && picked === o.item_id && <X size={15} className="mt-0.5 shrink-0 text-[#c62828]" aria-label="Wrong" />}
                      <span>{o.headline}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {done && (
        <p role="status" className="mt-4 font-headline text-lg font-semibold">
          {score} of {questions.length} — {score === questions.length ? "a perfect morning." : score > 0 ? "not bad at all." : "tomorrow's another paper."}
        </p>
      )}
    </section>
  );
}
