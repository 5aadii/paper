"use client";
// Chat-style News Assistant. Retrieved articles (facts) are shown separately from the AI summary.
import { ArrowUp, ExternalLink, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Result = { n: number; title: string; source: string; url: string; published_at: string | null; snippet: string; origin: string };
type Reply = {
  query: string;
  answer: string | null;
  ai_status: "success" | "unavailable" | "no_results";
  results: Result[];
  coverage: string;
  searched_for: string;
};
type Turn = { q: string; reply?: Reply; error?: string };

const EXAMPLES = [
  "What are today's major technology stories?",
  "Find recent news about Pakistan's economy",
  "Show me news about the 2018 elections in Pakistan",
  "Compare the latest reporting on AI regulation",
];

function fmtDate(iso: string | null) {
  if (!iso) return "Date unknown";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "Date unknown" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Renders "[2]" citations as small links to the matching result card. */
function Cited({ text, turn }: { text: string; turn: number }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        return m ? (
          <a key={i} href={`#r-${turn}-${m[1]}`} className="mx-0.5 align-super font-label text-xs font-bold text-accent no-underline">
            {m[1]}
          </a>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

export default function NewsAssistant() {
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || busy) return;
    setText("");
    setBusy(true);
    setTurns((t) => [...t, { q: query }]);
    let turn: Turn = { q: query };
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? "The news engine is warming up — try again in a minute." : "Search failed. Please try again.");
      turn = { q: query, reply: (await res.json()) as Reply };
    } catch (e) {
      turn = { q: query, error: e instanceof Error ? e.message : "Search failed." };
    }
    setTurns((t) => [...t.slice(0, -1), turn]);
    setBusy(false);
  }

  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      void ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-40 pt-8">
      <header>
        <p className="font-label text-xs uppercase tracking-widest text-accent">News Assistant</p>
        <h1 className="mt-1 font-headline text-4xl font-semibold md:text-5xl">Ask the newsroom</h1>
        <p className="mt-2 font-body text-lg italic text-muted">
          Ask about today&rsquo;s news or past events. Every answer is built only from real articles listed with it.
        </p>
      </header>

      {turns.length === 0 && (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => ask(e)} className="border border-ink/30 p-3 text-left font-body hover:border-ink">
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-10">
        {turns.map((t, ti) => (
          <section key={ti} className="space-y-4">
            <p className="ml-auto max-w-[85%] bg-ink px-4 py-2.5 font-body text-paper">{t.q}</p>
            {!t.reply && !t.error && (
              <p className="flex items-center gap-2 font-label text-xs uppercase tracking-widest text-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden /> Searching the news…
              </p>
            )}
            {t.error && <p className="font-body text-accent">{t.error}</p>}
            {t.reply && (
              <div className="space-y-5">
                {t.reply.answer ? (
                  <div className="border-l-[3px] border-accent pl-4">
                    <p className="font-label text-xs uppercase tracking-widest text-muted">AI summary of the sources below</p>
                    <p className="mt-1 whitespace-pre-line font-body text-[18px] leading-relaxed">
                      <Cited text={t.reply.answer} turn={ti} />
                    </p>
                  </div>
                ) : t.reply.ai_status === "no_results" ? (
                  <p className="font-body text-lg">
                    I couldn&rsquo;t find reliable articles for that. Try different keywords, a company or place name, or a year.
                  </p>
                ) : (
                  <p className="font-body italic text-muted">The AI summary isn&rsquo;t available right now — here are the articles I found.</p>
                )}

                {t.reply.results.length > 0 && (
                  <div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest">Retrieved articles</p>
                    <ol className="mt-2 divide-y divide-rule border-y border-ink/20">
                      {t.reply.results.map((r) => (
                        <li key={r.n} id={`r-${ti}-${r.n}`} className="scroll-mt-20 py-3">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3">
                            <span className="font-headline text-xl font-black text-accent">{r.n}</span>
                            <span className="min-w-0 flex-1">
                              <span className="font-headline text-lg font-bold leading-snug group-hover:underline group-hover:decoration-accent">
                                {r.title}
                              </span>
                              {r.snippet && <span className="mt-1 block line-clamp-2 font-body text-[15px] text-ink/80">{r.snippet}</span>}
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 font-label text-xs uppercase tracking-widest text-muted">
                                {r.source} · {fmtDate(r.published_at)} · via {r.origin}
                                <ExternalLink size={10} aria-hidden />
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="font-body text-sm italic text-muted">
                  {t.reply.coverage} Searched for: &ldquo;{t.reply.searched_for}&rdquo;.
                </p>
              </div>
            )}
          </section>
        ))}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
        className="fixed inset-x-0 bottom-[58px] z-30 border-t border-rule bg-paper px-4 py-3 md:bottom-0"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Ask about any news story, topic, company or year…"
            className="flex-1 border border-ink bg-paper px-4 py-3 font-body text-lg outline-none focus:border-accent"
            aria-label="Your question"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Ask" className="bg-accent p-3.5 text-paper disabled:opacity-40">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </form>
    </main>
  );
}
