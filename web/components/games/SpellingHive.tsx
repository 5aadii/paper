"use client";
// Spelling Hive: make words from seven letters; every word must use the centre letter.
import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Delete, Shuffle } from "lucide-react";
import { buildPuzzle, isPangram, rankIndex, rankThresholds, RANKS, wordScore } from "@/lib/games/bee";
import { loadCommon } from "@/lib/games/dict";
import { gameKey, loadJSON, saveJSON } from "@/lib/games/storage";
import { GameLoading } from "./GameHeader";
import { useClientDay, useKeyboard } from "./hooks";
import styles from "./styles";

const HEX_W = 84;
const HEX_H = Math.round(HEX_W * 0.866);
const GAP = 1.1;
const OFFSETS: [number, number][] = [
  [0, -1],
  [0.75, -0.5],
  [0.75, 0.5],
  [0, 1],
  [-0.75, 0.5],
  [-0.75, -0.5],
];
const BOX_W = Math.round(HEX_W + 2 * 0.75 * HEX_W * GAP);
const BOX_H = Math.round(HEX_H + 2 * HEX_H * GAP);

export default function SpellingHiveGame() {
  const day = useClientDay();
  if (!day) return <GameLoading />;
  return <HiveLoader key={day} day={day} />;
}

function HiveLoader({ day }: { day: string }) {
  const [words, setWords] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadCommon()
      .then((w) => alive && setWords(w))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  if (failed) return <GameLoading label="Couldn't load the word list. Check your connection and reload." />;
  if (!words) return <GameLoading label="Building today's hive…" />;
  return <Hive day={day} words={words} />;
}

function Hive({ day, words }: { day: string; words: string[] }) {
  const puzzle = useMemo(() => buildPuzzle(words, day), [words, day]);
  const letters = useMemo(() => [puzzle.center, ...puzzle.outer], [puzzle]);
  const answerSet = useMemo(() => new Set(puzzle.answers), [puzzle]);
  const storeKey = gameKey("hive", day);

  const [found, setFound] = useState<string[]>(() => loadJSON<{ found: string[] }>(storeKey)?.found ?? []);
  const [input, setInput] = useState("");
  const [order, setOrder] = useState([0, 1, 2, 3, 4, 5]);
  const [message, setMessage] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    saveJSON(storeKey, { found });
  }, [found, storeKey]);

  const score = found.reduce((s, w) => s + wordScore(w, letters), 0);
  const rank = rankIndex(score, puzzle.maxScore);
  const thresholds = rankThresholds(puzzle.maxScore);
  const nextRank = rank < RANKS.length - 1 ? thresholds[rank + 1] - score : 0;

  function flash(text: string, good: boolean) {
    const id = Date.now();
    setMessage({ text, good, id });
    window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), 1500);
  }

  function reject(text: string) {
    setShake((s) => s + 1);
    flash(text, false);
    window.setTimeout(() => setInput(""), 450);
  }

  function enter() {
    const w = input;
    if (!w) return;
    if (w.length < 4) return reject("Too short");
    if (!w.includes(puzzle.center)) return reject("Missing centre letter");
    if ([...w].some((c) => !letters.includes(c))) return reject("Bad letters");
    if (found.includes(w)) return reject("Already found");
    if (!answerSet.has(w)) return reject("Not in word list");
    const pts = wordScore(w, letters);
    setFound((f) => [...f, w]);
    setInput("");
    if (isPangram(w, letters)) flash(`Pangram! +${pts}`, true);
    else flash(`${w.length === 4 ? "Good!" : w.length < 7 ? "Nice!" : "Awesome!"} +${pts}`, true);
  }

  function type(l: string) {
    setInput((s) => (s.length < 19 ? s + l : s));
  }

  function shuffleLetters() {
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  useKeyboard((e) => {
    if (e.key === "Enter") enter();
    else if (e.key === "Backspace") setInput((s) => s.slice(0, -1));
    else if (e.key === " ") shuffleLetters();
    else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
    else return;
    e.preventDefault();
  });

  const sortedFound = [...found].sort();

  return (
    <div className="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
      <section className="w-full lg:w-[420px]" aria-label="Progress">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-headline text-xl font-semibold text-ink">{RANKS[rank].name}</h2>
            <p className="font-label text-sm tabular-nums text-muted">
              <span className="font-semibold text-ink">{score}</span> pts
            </p>
          </div>
          <div className="relative mt-4 h-5" aria-hidden>
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-rule" />
            <div className="relative flex h-full items-center justify-between">
              {RANKS.map((r, i) => (
                <span
                  key={r.name}
                  title={`${r.name}: ${thresholds[i]}`}
                  className={`flex items-center justify-center rounded-full font-label text-[10px] font-bold tabular-nums ${
                    i === rank
                      ? "h-6 w-6 bg-[#f7da21] text-[#1a1a1a]"
                      : i < rank
                        ? "h-2.5 w-2.5 bg-[#f7da21]"
                        : "h-2.5 w-2.5 bg-rule"
                  }`}
                >
                  {i === rank ? score : ""}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 font-label text-xs text-muted">
            {nextRank > 0
              ? `${nextRank} more point${nextRank === 1 ? "" : "s"} to ${RANKS[rank + 1].name}.`
              : "Top rank reached. Can you find every word?"}{" "}
            {puzzle.answers.length} words today.
          </p>
        </div>

        <div className="glass-card mt-4 rounded-3xl p-5">
          <h3 className="font-label text-xs font-bold uppercase tracking-[0.14em] text-muted">
            You have found {found.length} word{found.length === 1 ? "" : "s"}
          </h3>
          {sortedFound.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {sortedFound.map((w) => (
                <li
                  key={w}
                  className={`border-b border-rule py-1 font-body text-[15px] capitalize ${
                    isPangram(w, letters) ? "font-semibold text-accent" : "text-ink"
                  }`}
                >
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-body text-[15px] text-muted">Words you find will appear here.</p>
          )}
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center" aria-label="Hive">
        <div className="relative h-6 w-full">
          {message && (
            <div
              key={message.id}
              className={`glass-strong absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1 font-label text-sm font-semibold ${
                message.good ? "text-ink" : "text-muted"
              } ${styles.toast}`}
              role="status"
            >
              {message.text}
            </div>
          )}
        </div>

        <div
          key={`input-${shake}`}
          className={`mt-4 flex min-h-[3rem] max-w-full items-center justify-center overflow-hidden font-label text-[clamp(1.6rem,7vw,2.25rem)] font-bold uppercase tracking-wide ${
            shake ? styles.shake : ""
          }`}
          aria-live="polite"
          aria-label="Current word"
        >
          {[...input].map((c, i) => (
            <span
              key={i}
              className={c === puzzle.center ? "text-[#d9b500]" : letters.includes(c) ? "text-ink" : "text-muted/60"}
            >
              {c}
            </span>
          ))}
          <span className="ml-0.5 inline-block h-9 w-[2px] animate-pulse bg-[#d9b500]" aria-hidden />
        </div>

        <div className="relative mt-6" style={{ width: BOX_W, height: BOX_H }} role="group" aria-label="Letters">
          {[puzzle.center, ...order.map((i) => puzzle.outer[i])].map((l, i) => {
            const [dx, dy] = i === 0 ? [0, 0] : OFFSETS[i - 1];
            const left = BOX_W / 2 - HEX_W / 2 + dx * HEX_W * GAP;
            const top = BOX_H / 2 - HEX_H / 2 + dy * HEX_H * GAP;
            return (
              <button
                key={i === 0 ? "center" : `o${i}`}
                type="button"
                onClick={() => type(l)}
                aria-label={i === 0 ? `Centre letter ${l}` : `Letter ${l}`}
                className={`glass-key absolute !text-[1.7rem] !font-bold uppercase ${styles.hex} ${
                  i === 0 ? "!bg-[#f7da21] !text-[#1a1a1a]" : ""
                }`}
                style={{ left, top, width: HEX_W, height: HEX_H }}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button type="button" className="btn btn-glass" onClick={() => setInput((s) => s.slice(0, -1))}>
            <Delete size={16} aria-hidden /> Delete
          </button>
          <button type="button" className="btn btn-glass !px-3" onClick={shuffleLetters} aria-label="Shuffle letters">
            <Shuffle size={18} aria-hidden />
          </button>
          <button type="button" className="btn btn-primary" onClick={enter}>
            Enter <CornerDownLeft size={16} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}
