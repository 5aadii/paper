"use client";
// Connections: find four groups of four. Four mistakes allowed.
import { useEffect, useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { dailyPuzzle, groupOf, LEVEL_COLORS, startingOrder, type ConnectionsPuzzle } from "@/lib/games/connections";
import { gameKey, loadJSON, saveJSON } from "@/lib/games/storage";
import { GameLoading } from "./GameHeader";
import { useClientDay } from "./hooks";
import styles from "./styles";

const MAX_MISTAKES = 4;
type Saved = { puzzleId: string; solved: number[]; mistakes: number; guesses: string[] };

export default function ConnectionsGame() {
  const day = useClientDay();
  if (!day) return <GameLoading />;
  return <Connections key={day} day={day} />;
}

function GroupBar({ puzzle, index, delay = 0 }: { puzzle: ConnectionsPuzzle; index: number; delay?: number }) {
  const gr = puzzle.groups[index];
  return (
    <div
      className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl px-3 py-2 text-center text-[#121212] ${styles.reveal}`}
      style={{ background: LEVEL_COLORS[index], animationDelay: `${delay}ms` }}
      role="listitem"
    >
      <p className="font-label text-[13px] font-bold uppercase tracking-[0.08em] sm:text-sm">{gr.title}</p>
      <p className="mt-0.5 font-label text-[13px] uppercase sm:text-sm">{gr.words.join(", ")}</p>
    </div>
  );
}

function Connections({ day }: { day: string }) {
  const puzzle = useMemo(() => dailyPuzzle(day), [day]);
  const storeKey = gameKey("connections", day);
  const [game, setGame] = useState<Saved>(() => {
    const saved = loadJSON<Saved>(storeKey);
    return saved && saved.puzzleId === puzzle.id ? saved : { puzzleId: puzzle.id, solved: [], mistakes: 0, guesses: [] };
  });
  const [order, setOrder] = useState<string[]>(() => startingOrder(puzzle, day));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [shake, setShake] = useState<{ n: number; words: string[] }>({ n: 0, words: [] });

  useEffect(() => {
    saveJSON(storeKey, game);
  }, [game, storeKey]);

  const won = game.solved.length === 4;
  const lost = !won && game.mistakes >= MAX_MISTAKES;
  const over = won || lost;
  const remaining = order.filter((w) => !game.solved.includes(groupOf(puzzle, w)));
  const unsolved = [0, 1, 2, 3].filter((i) => !game.solved.includes(i));

  function flash(text: string) {
    const id = Date.now();
    setMessage({ text, id });
    window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), 1800);
  }

  function toggle(w: string) {
    if (over) return;
    setShake((s) => (s.words.length ? { ...s, words: [] } : s));
    setSelected((s) => (s.includes(w) ? s.filter((x) => x !== w) : s.length < 4 ? [...s, w] : s));
  }

  function shuffleWords() {
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  function submit() {
    if (over || selected.length !== 4) return;
    const key = [...selected].sort().join("|");
    if (game.guesses.includes(key)) {
      flash("Already guessed!");
      return;
    }
    const groups = selected.map((w) => groupOf(puzzle, w));
    const counts = [0, 0, 0, 0];
    for (const gi of groups) counts[gi]++;
    if (counts.some((c) => c === 4)) {
      setGame((g) => ({ ...g, guesses: [...g.guesses, key], solved: [...g.solved, groups[0]] }));
      setSelected([]);
      return;
    }
    const mistakes = game.mistakes + 1;
    setGame((g) => ({ ...g, guesses: [...g.guesses, key], mistakes }));
    setShake((s) => ({ n: s.n + 1, words: selected }));
    if (mistakes >= MAX_MISTAKES) {
      setSelected([]);
      flash("Next time!");
    } else if (counts.some((c) => c === 3)) {
      flash("One away…");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <p className="text-center font-body text-[16px] text-muted">Create four groups of four!</p>

      <div className="relative h-0">
        {message && (
          <div
            key={message.id}
            className={`glass-strong absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl px-4 py-2 font-label text-sm font-semibold text-ink ${styles.toast}`}
            role="status"
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2" role="list" aria-label="Solved groups">
        {game.solved.map((gi) => (
          <GroupBar key={gi} puzzle={puzzle} index={gi} />
        ))}
        {lost && unsolved.map((gi, k) => <GroupBar key={gi} puzzle={puzzle} index={gi} delay={k * 350} />)}
      </div>

      {!over && (
        <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Words">
          {remaining.map((w) => {
            const isSel = selected.includes(w);
            const shaking = isSel && shake.words.includes(w);
            const size = w.length > 9 ? "text-[10px] sm:text-[13px]" : w.length > 7 ? "text-[11.5px] sm:text-sm" : "text-[13px] sm:text-base";
            return (
              <button
                key={shaking ? `${w}-${shake.n}` : w}
                type="button"
                aria-pressed={isSel}
                onClick={() => toggle(w)}
                className={`glass-key !h-[4.5rem] !w-auto min-w-0 !rounded-xl px-1 !font-bold uppercase leading-tight tracking-tight ${size} ${
                  isSel ? `!bg-ink !text-paper ${shaking ? styles.shake : ""}` : ""
                }`}
              >
                <span className="break-words">{w}</span>
              </button>
            );
          })}
        </div>
      )}

      {!over ? (
        <>
          <div className="mt-5 flex items-center justify-center gap-2 font-label text-sm text-muted">
            Mistakes remaining:
            <span className="flex gap-1.5" aria-label={`${MAX_MISTAKES - game.mistakes} mistakes remaining`}>
              {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full transition-opacity ${i < MAX_MISTAKES - game.mistakes ? "bg-ink/70" : "bg-ink/10"}`}
                />
              ))}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-glass" onClick={shuffleWords}>
              <Shuffle size={16} aria-hidden /> Shuffle
            </button>
            <button type="button" className="btn btn-glass" onClick={() => setSelected([])} disabled={!selected.length}>
              Deselect all
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={selected.length !== 4}>
              Submit
            </button>
          </div>
        </>
      ) : (
        <div className="glass-card mt-6 rounded-3xl p-5 text-center" role="status">
          <h2 className="font-headline text-2xl font-semibold text-ink">{won ? "Perfect connections" : "Next time!"}</h2>
          <p className="mt-1 font-body text-muted">
            {won
              ? game.mistakes === 0
                ? "Solved without a single mistake."
                : `Solved with ${game.mistakes} mistake${game.mistakes === 1 ? "" : "s"}.`
              : "Here's how the groups fit together."}{" "}
            New puzzle tomorrow.
          </p>
        </div>
      )}
    </div>
  );
}
