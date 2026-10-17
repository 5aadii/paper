"use client";
// Sudoku: daily puzzle per difficulty (seeded by date), or a fresh random one on request.
// Number entry uses a round glass keypad modelled on the iPhone passcode screen.
import { useEffect, useMemo, useState } from "react";
import { Eraser, Pencil, RotateCcw, Timer, Trophy, Undo2 } from "lucide-react";
import { DIFFICULTIES, box, col, conflicts, dailyPuzzle, generate, row, PEERS, type Difficulty, type Puzzle } from "@/lib/games/sudoku";
import { formatClock, mulberry32 } from "@/lib/games/rng";
import { gameKey, loadJSON, saveJSON } from "@/lib/games/storage";
import { GameLoading } from "./GameHeader";
import { useClientDay, useKeyboard, useTicker } from "./hooks";

type Board = {
  puzzle: Puzzle;
  daily: boolean;
  values: number[];
  notes: number[]; // bitmask per cell, bit d = pencil mark d
  elapsed: number;
  done: boolean;
};
type Snapshot = { values: number[]; notes: number[] };

const LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

function freshBoard(puzzle: Puzzle, daily: boolean): Board {
  return { puzzle, daily, values: [...puzzle.givens], notes: Array(81).fill(0), elapsed: 0, done: false };
}

function loadBoard(day: string, difficulty: Difficulty): Board {
  const saved = loadJSON<Board>(gameKey("sudoku", day, difficulty));
  if (saved && saved.puzzle?.givens?.length === 81 && saved.values?.length === 81) return saved;
  return freshBoard(dailyPuzzle(day, difficulty), true);
}

export default function SudokuGame() {
  const day = useClientDay();
  if (!day) return <GameLoading />;
  return <Sudoku key={day} day={day} />;
}

function Sudoku({ day }: { day: string }) {
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => loadJSON<Difficulty>(gameKey("sudoku", "last-difficulty")) ?? "easy",
  );
  const [board, setBoard] = useState<Board>(() => loadBoard(day, difficulty));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);

  useEffect(() => {
    saveJSON(gameKey("sudoku", day, difficulty), board);
  }, [board, day, difficulty]);

  useTicker(!board.done, () => {
    if (document.visibilityState === "visible") setBoard((b) => ({ ...b, elapsed: b.elapsed + 1 }));
  });

  const { puzzle, values, notes, done } = board;
  const clashes = useMemo(() => conflicts(values), [values]);
  const counts = useMemo(() => {
    const c = Array(10).fill(0);
    for (const v of values) c[v]++;
    return c;
  }, [values]);

  function switchDifficulty(d: Difficulty) {
    if (d === difficulty) return;
    saveJSON(gameKey("sudoku", "last-difficulty"), d);
    setDifficulty(d);
    setBoard(loadBoard(day, d));
    setHistory([]);
    setSelected(null);
  }

  function newPuzzle() {
    const seed = Math.floor(Math.random() * 2 ** 32);
    setBoard(freshBoard(generate(mulberry32(seed), difficulty), false));
    setHistory([]);
    setSelected(null);
  }

  function restartDaily() {
    setBoard(freshBoard(dailyPuzzle(day, difficulty), true));
    setHistory([]);
    setSelected(null);
  }

  function commit(nextValues: number[], nextNotes: number[]) {
    setHistory((h) => [...h.slice(-199), { values, notes }]);
    const solved = nextValues.every((v, i) => v === puzzle.solution[i]);
    setBoard((b) => ({ ...b, values: nextValues, notes: nextNotes, done: solved }));
  }

  function input(d: number) {
    if (done || selected === null || puzzle.givens[selected]) return;
    const i = selected;
    if (notesMode) {
      if (values[i]) return;
      const nextNotes = [...notes];
      nextNotes[i] ^= 1 << d;
      commit(values, nextNotes);
      return;
    }
    const nextValues = [...values];
    const nextNotes = [...notes];
    nextValues[i] = values[i] === d ? 0 : d;
    nextNotes[i] = 0;
    if (nextValues[i]) for (const p of PEERS[i]) nextNotes[p] &= ~(1 << d);
    commit(nextValues, nextNotes);
  }

  function erase() {
    if (done || selected === null || puzzle.givens[selected]) return;
    if (!values[selected] && !notes[selected]) return;
    const nextValues = [...values];
    const nextNotes = [...notes];
    nextValues[selected] = 0;
    nextNotes[selected] = 0;
    commit(nextValues, nextNotes);
  }

  function undo() {
    if (done || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard((b) => ({ ...b, values: last.values, notes: last.notes }));
  }

  useKeyboard((e) => {
    if (/^[1-9]$/.test(e.key)) {
      input(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      erase();
    } else if (e.key === "n" || e.key === "N") {
      setNotesMode((m) => !m);
    } else if (e.key === "u" || e.key === "U") {
      undo();
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const cur = selected ?? 40;
      const r = row(cur);
      const c = col(cur);
      const next =
        e.key === "ArrowUp" ? ((r + 8) % 9) * 9 + c
        : e.key === "ArrowDown" ? ((r + 1) % 9) * 9 + c
        : e.key === "ArrowLeft" ? r * 9 + ((c + 8) % 9)
        : r * 9 + ((c + 1) % 9);
      setSelected(next);
    } else {
      return;
    }
  });

  const sel = selected;
  const selValue = sel !== null ? values[sel] : 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <div className="w-full max-w-[520px] lg:flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="segmented" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button key={d} type="button" aria-pressed={d === difficulty} onClick={() => switchDifficulty(d)}>
                {LABELS[d]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 font-label text-sm tabular-nums text-muted" aria-label="Time">
            <Timer size={15} aria-hidden />
            {formatClock(board.elapsed)}
          </div>
        </div>

        <div
          className="glass-strong grid aspect-square w-full grid-cols-9 overflow-hidden rounded-2xl !border-2 !border-ink/70"
          role="grid"
          aria-label="Sudoku board"
        >
          {values.map((v, i) => {
            const given = puzzle.givens[i] !== 0;
            const isSel = sel === i;
            const related = sel !== null && !isSel && (row(sel) === row(i) || col(sel) === col(i) || box(sel) === box(i));
            const sameDigit = !!selValue && v === selValue && !isSel;
            const clash = clashes.has(i);
            const c = col(i);
            const r = row(i);
            const borders = [
              c === 8 ? "" : c % 3 === 2 ? "border-r-2 border-r-ink/60" : "border-r border-r-rule",
              r === 8 ? "" : r % 3 === 2 ? "border-b-2 border-b-ink/60" : "border-b border-b-rule",
            ].join(" ");
            const bg = isSel
              ? "bg-accent/25"
              : clash && !given
                ? "bg-[#e5484d]/15"
                : sameDigit
                  ? "bg-accent/15"
                  : related
                    ? "bg-ink/[0.05]"
                    : "";
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${v || "empty"}`}
                onClick={() => setSelected(i)}
                className={`relative flex items-center justify-center p-0 font-label outline-none transition-colors ${borders} ${bg}`}
              >
                {v ? (
                  <span
                    className={`text-[clamp(1.1rem,5.4vw,1.75rem)] leading-none ${
                      clash ? "text-[#e5484d]" : given ? "font-semibold text-ink" : "font-normal text-accent"
                    }`}
                  >
                    {v}
                  </span>
                ) : notes[i] ? (
                  <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px] text-[clamp(7px,2.2vw,11px)] leading-none text-muted">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <span key={d} className="flex items-center justify-center">
                        {notes[i] & (1 << d) ? d : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-label text-xs text-muted">
            {board.daily ? `Daily puzzle · ${LABELS[difficulty]}` : `Practice puzzle · ${LABELS[difficulty]}`}
          </p>
          <div className="flex gap-2">
            {!board.daily && (
              <button type="button" className="btn btn-glass btn-sm" onClick={restartDaily}>
                Back to daily
              </button>
            )}
            <button type="button" className="btn btn-glass btn-sm" onClick={newPuzzle}>
              <RotateCcw size={14} aria-hidden /> New puzzle
            </button>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-center lg:w-auto lg:pt-12">
        {done ? (
          <div className="glass-card w-full max-w-[340px] rounded-3xl p-6 text-center" role="status">
            <Trophy className="mx-auto text-accent" size={34} aria-hidden />
            <h2 className="mt-2 font-headline text-2xl font-semibold text-ink">Solved!</h2>
            <p className="mt-1 font-body text-muted">
              {LABELS[difficulty]} in {formatClock(board.elapsed)}.
            </p>
            <button type="button" className="btn btn-primary mt-4" onClick={newPuzzle}>
              Play another
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-x-5 gap-y-3.5" role="group" aria-label="Number pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                const left = 9 - counts[d];
                return (
                  <button
                    key={d}
                    type="button"
                    className="glass-key h-[4.25rem] w-[4.25rem] flex-col sm:h-[4.75rem] sm:w-[4.75rem]"
                    data-pressed={notesMode && sel !== null && (notes[sel] & (1 << d)) ? "true" : undefined}
                    onClick={() => input(d)}
                    aria-label={`${notesMode ? "Note" : "Enter"} ${d}`}
                  >
                    <span className="text-[2rem] font-light leading-none sm:text-[2.25rem]">{d}</span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {left > 0 ? `${left} left` : "done"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button type="button" className="btn btn-glass btn-sm" onClick={undo} disabled={history.length === 0}>
                <Undo2 size={15} aria-hidden /> Undo
              </button>
              <button type="button" className="btn btn-glass btn-sm" onClick={erase}>
                <Eraser size={15} aria-hidden /> Erase
              </button>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                aria-pressed={notesMode}
                onClick={() => setNotesMode((m) => !m)}
              >
                <Pencil size={15} aria-hidden /> Notes {notesMode ? "on" : "off"}
              </button>
            </div>
            <p className="mt-3 max-w-[300px] text-center font-label text-xs text-muted">
              Tip: type 1–9, arrow keys to move, N for notes, U to undo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
