"use client";
// Wordplay: guess the day's five-letter word in six tries.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, Copy, Delete } from "lucide-react";
import { dailyAnswer, MARK_COLORS, scoreGuess, type Mark } from "@/lib/games/wordle";
import { loadValid } from "@/lib/games/dict";
import { gameKey, loadJSON, saveJSON } from "@/lib/games/storage";
import { GameLoading } from "./GameHeader";
import { useClientDay, useKeyboard } from "./hooks";
import styles from "./styles";

const ROWS = 6;
const LEN = 5;
const FLIP_STEP = 260;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];
const RANK: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
const PRAISE = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"];
const EMOJI: Record<Mark, string> = { correct: "🟩", present: "🟨", absent: "⬛" };

export default function WordplayGame() {
  const day = useClientDay();
  if (!day) return <GameLoading />;
  return <Wordplay key={day} day={day} />;
}

function Wordplay({ day }: { day: string }) {
  const answer = useMemo(() => dailyAnswer(day), [day]);
  const storeKey = gameKey("wordplay", day);
  const [guesses, setGuesses] = useState<string[]>(() => loadJSON<{ guesses: string[] }>(storeKey)?.guesses ?? []);
  const [current, setCurrent] = useState("");
  const [valid, setValid] = useState<Set<string> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [shake, setShake] = useState({ n: 0, row: -1 });
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadValid()
      .then((s) => alive && setValid(s))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    saveJSON(storeKey, { guesses });
  }, [guesses, storeKey]);

  const marks = useMemo(() => guesses.map((g) => scoreGuess(g, answer)), [guesses, answer]);
  const won = guesses.includes(answer);
  const over = won || guesses.length >= ROWS;
  const animating = revealRow !== null;

  const keyStatus = useMemo(() => {
    const out: Record<string, Mark> = {};
    guesses.forEach((g, gi) => {
      if (gi === revealRow) return; // wait for the flip to finish
      [...g].forEach((ch, i) => {
        const m = marks[gi][i];
        if (!out[ch] || RANK[m] > RANK[out[ch]]) out[ch] = m;
      });
    });
    return out;
  }, [guesses, marks, revealRow]);

  function flash(text: string, ms = 1600) {
    const id = Date.now();
    setMessage({ text, id });
    window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), ms);
  }

  function submit() {
    if (current.length < LEN) {
      setShake((s) => ({ n: s.n + 1, row: guesses.length }));
      flash("Not enough letters");
      return;
    }
    if (!valid) {
      flash(loadError ? "Couldn't load the dictionary" : "Loading the dictionary…");
      return;
    }
    if (!valid.has(current)) {
      setShake((s) => ({ n: s.n + 1, row: guesses.length }));
      flash("Not in word list");
      return;
    }
    const next = [...guesses, current];
    const row = guesses.length;
    setGuesses(next);
    setCurrent("");
    setRevealRow(row);
    const total = FLIP_STEP * (LEN - 1) + 540;
    window.setTimeout(() => {
      setRevealRow(null);
      if (current === answer) flash(PRAISE[row] ?? "Nice!", 2400);
      else if (next.length >= ROWS) flash(answer.toUpperCase(), 4000);
    }, total);
  }

  function press(key: string) {
    if (over || animating) return;
    if (key === "enter") submit();
    else if (key === "back") setCurrent((c) => c.slice(0, -1));
    else if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < LEN ? c + key : c));
  }

  useKeyboard((e) => {
    if (e.key === "Enter") press("enter");
    else if (e.key === "Backspace") press("back");
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    else return;
    e.preventDefault();
  });

  async function share() {
    const lines = marks.map((m) => m.map((x) => EMOJI[x]).join(""));
    const text = `Wordplay ${day} ${won ? guesses.length : "X"}/${ROWS}\n\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      flash("Couldn't copy. Your browser blocked the clipboard.");
    }
  }

  const rows = Array.from({ length: ROWS }, (_, r) => {
    if (r < guesses.length) return guesses[r];
    if (r === guesses.length) return current;
    return "";
  });

  return (
    <div className="mx-auto flex w-full max-w-[500px] flex-col items-center">
      <div className="relative h-0 w-full">
        {message && (
          <div
            key={message.id}
            className={`glass-strong absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl px-4 py-2 font-label text-sm font-semibold text-ink ${styles.toast}`}
            role="status"
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="mt-12 grid gap-1.5" role="grid" aria-label="Guesses">
        {rows.map((word, r) => {
          const submitted = r < guesses.length;
          const isCurrent = r === guesses.length;
          return (
            <div
              key={isCurrent ? `cur-${shake.n}` : `row-${r}`}
              className={`grid grid-cols-5 gap-1.5 ${isCurrent && shake.row === r ? styles.shake : ""} ${
                won && submitted && r === guesses.length - 1 && !animating ? styles.bounce : ""
              }`}
              role="row"
            >
              {Array.from({ length: LEN }, (_, i) => {
                const ch = word[i] ?? "";
                const mark = submitted ? marks[r][i] : null;
                const flipping = submitted && r === revealRow;
                const base =
                  "flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-lg border-2 font-label text-[1.9rem] font-bold uppercase leading-none sm:h-[3.75rem] sm:w-[3.75rem]";
                if (mark && flipping) {
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      className={`${base} ${styles.flip}`}
                      style={
                        {
                          "--from-bg": "transparent",
                          "--from-border": "var(--muted)",
                          "--to-bg": MARK_COLORS[mark],
                          animationDelay: `${i * FLIP_STEP}ms`,
                        } as CSSProperties
                      }
                    >
                      {ch}
                    </div>
                  );
                }
                if (mark) {
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={`${ch}, ${mark}`}
                      className={`${base} text-white`}
                      style={{ background: MARK_COLORS[mark], borderColor: MARK_COLORS[mark] }}
                    >
                      {ch}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    role="gridcell"
                    className={`${base} text-ink ${ch ? `border-ink/50 ${styles.pop}` : "border-rule bg-paper/30"}`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {over && !animating && (
        <div className="glass-card mt-6 w-full rounded-3xl p-5 text-center" role="status">
          <h2 className="font-headline text-2xl font-semibold text-ink">
            {won ? `Solved in ${guesses.length}/${ROWS}` : "Out of guesses"}
          </h2>
          <p className="mt-1 font-body text-muted">
            The word was <strong className="font-label uppercase tracking-wider text-ink">{answer}</strong>. New word
            tomorrow.
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={share}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? "Copied" : "Copy result"}
          </button>
        </div>
      )}

      <div className="mt-8 flex w-full flex-col gap-2" role="group" aria-label="Keyboard">
        {KEY_ROWS.map((keys, ri) => (
          <div key={ri} className="flex w-full justify-center gap-1.5">
            {ri === 1 && <span className="flex-[0.5]" aria-hidden />}
            {[...keys].map((k) => {
              const key = k === "+" ? "enter" : k === "-" ? "back" : k;
              const wide = key === "enter" || key === "back";
              const st = keyStatus[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  aria-label={key === "back" ? "Delete" : key === "enter" ? "Enter" : st ? `${key}, ${st}` : key}
                  className={`glass-key !h-14 !w-auto min-w-0 !rounded-xl !text-[0.95rem] !font-semibold uppercase ${
                    wide ? "flex-[1.5] !text-[0.7rem] tracking-wide" : "flex-1"
                  } ${st ? "!text-white" : ""}`}
                  style={st ? { background: MARK_COLORS[st], borderColor: MARK_COLORS[st] } : undefined}
                >
                  {key === "back" ? <Delete size={20} aria-hidden /> : key}
                </button>
              );
            })}
            {ri === 1 && <span className="flex-[0.5]" aria-hidden />}
          </div>
        ))}
      </div>
    </div>
  );
}
