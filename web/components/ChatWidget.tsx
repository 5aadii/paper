"use client";
// News Assistant as a long glass "Ask anything" bar at the bottom right. Typing in it opens the
// conversation above it. Any page can open it with a question: openAssistant("What happened with …").
import { ArrowUp, ChevronDown, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isNavHidden } from "./AppNav";

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

const OPEN_EVENT = "open-assistant";
const EXAMPLES = ["Today's top technology stories", "Latest on Pakistan's economy", "What's new in AI regulation?"];

/** Opens the chat from anywhere, optionally asking a question straight away. */
export function openAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: question ?? "" }));
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "[2]" citations become small superscript links to the matching source. */
function Cited({ text, turn }: { text: string; turn: number }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        return m ? (
          <a key={i} href={`#chat-${turn}-${m[1]}`} className="mx-0.5 align-super text-[10px] font-bold text-accent no-underline">
            {m[1]}
          </a>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

export default function ChatWidget() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || busyRef.current) return;
    busyRef.current = true;
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
      if (!res.ok) throw new Error(res.status === 503 ? "The news engine is warming up. Try again in a minute." : "Search failed. Please try again.");
      turn = { q: query, reply: (await res.json()) as Reply };
    } catch (e) {
      turn = { q: query, error: e instanceof Error ? e.message : "Search failed." };
    }
    setTurns((t) => [...t.slice(0, -1), turn]);
    setBusy(false);
    busyRef.current = false;
  }

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string>).detail;
      if (q) void ask(q);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      input.current?.focus();
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [open, turns, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Hidden while playing a game, so it never covers a keyboard or board.
  if (isNavHidden(path) || path.startsWith("/assistant") || path.startsWith("/games/")) return null;

  return (
    <div className="no-print fixed inset-x-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-stretch gap-2.5 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]">
      {open && (
        <section
          role="dialog"
          aria-label="News Assistant"
          className="glass-strong sheet-in flex h-[min(560px,calc(100dvh-13rem))] flex-col overflow-hidden rounded-[1.75rem]"
        >
          <header className="flex items-center justify-between px-5 pb-2 pt-3.5">
            <div>
              <p className="font-label text-[15px] font-semibold">News Assistant</p>
              <p className="font-label text-xs text-muted">Answers built from real articles</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimise chat" className="btn btn-glass !p-2">
              <ChevronDown size={16} aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-2">
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="font-body text-[15px] text-muted">Ask about today&rsquo;s news or anything in the past.</p>
                {EXAMPLES.map((e) => (
                  <button key={e} type="button" onClick={() => ask(e)} className="btn btn-glass btn-sm w-full !justify-start !whitespace-normal text-left">
                    {e}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, ti) => (
              <div key={ti} className="space-y-3">
                <p className="ml-auto w-fit max-w-[85%] rounded-[1.2rem] rounded-br-md bg-accent px-3.5 py-2 font-label text-[14px] leading-snug text-white">
                  {t.q}
                </p>
                {!t.reply && !t.error && (
                  <p className="flex items-center gap-2 font-label text-xs text-muted">
                    <Loader2 size={14} className="animate-spin" aria-hidden /> Searching the news…
                  </p>
                )}
                {t.error && <p className="font-label text-sm text-[#c62828]">{t.error}</p>}
                {t.reply && (
                  <div className="max-w-[95%] space-y-3 rounded-[1.2rem] rounded-bl-md bg-paper/70 px-3.5 py-3">
                    <p className="whitespace-pre-line font-body text-[15px] leading-relaxed">
                      {t.reply.answer ? (
                        <Cited text={t.reply.answer} turn={ti} />
                      ) : t.reply.ai_status === "no_results" ? (
                        "I couldn’t find reliable articles for that. Try a company, place or year."
                      ) : (
                        "The AI summary isn’t available right now. Here are the articles I found."
                      )}
                    </p>
                    {t.reply.results.length > 0 && (
                      <ol className="space-y-1.5">
                        {t.reply.results.slice(0, 5).map((r) => (
                          <li key={r.n} id={`chat-${ti}-${r.n}`} className="scroll-mt-4">
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex gap-2 rounded-xl px-1.5 py-1 hover:bg-[var(--glass-tint)]">
                              <span className="font-label text-xs font-bold text-accent">{r.n}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-headline text-[14px] font-semibold leading-snug group-hover:underline">{r.title}</span>
                                <span className="flex items-center gap-1 font-label text-[11px] text-muted">
                                  {r.source}
                                  {fmtDate(r.published_at) && ` · ${fmtDate(r.published_at)}`}
                                  <ExternalLink size={10} aria-hidden />
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottom} />
          </div>

        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(true);
          void ask(text);
        }}
        className="glass-strong flex h-14 items-center gap-2 rounded-full pl-2 pr-2 shadow-lg"
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_12px_-2px_rgba(88,86,214,0.6)]"
          style={{ background: "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 55%),linear-gradient(135deg,#0a84ff,#5e5ce6 55%,#bf5af2)" }}
        >
          <Sparkles size={18} />
        </span>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          maxLength={300}
          placeholder="Ask anything about the news…"
          aria-label="Ask the News Assistant"
          className="min-w-0 flex-1 bg-transparent px-1 font-label text-[15px] outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="btn btn-primary h-10 w-10 shrink-0 !p-0 disabled:opacity-40">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
        </button>
      </form>
    </div>
  );
}
