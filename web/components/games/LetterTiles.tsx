"use client";
// Letter Tiles: a daily rack of seven Scrabble tiles. Make as many words as you can in
// three minutes; letters score their Scrabble values and using all seven earns a bingo.
import { useEffect, useMemo, useState } from "react";
import { Flag, Play, Shuffle, Timer, X } from "lucide-react";
import { BINGO_BONUS, bestWords, dailyRack, GAME_SECONDS, LETTER_VALUES, MIN_WORD, RACK_SIZE, wordScore } from "@/lib/games/tiles";
import { loadValid } from "@/lib/games/dict";
import { formatClock } from "@/lib/games/rng";
import { gameKey, loadJSON, saveJSON } from "@/lib/games/storage";
import { GameLoading } from "./GameHeader";
import { useClientDay, useKeyboard, useTicker } from "./hooks";
import styles from "./styles";

type Played = { word: string; score: number };
type Saved = { played: Played[]; remaining: number; done: boolean };

export default function LetterTilesGame() {
  const day = useClientDay();
  if (!day) return <GameLoading />;
  return <LetterTiles key={day} day={day} />;
}

function Tile({
  letter,
  onClick,
  disabled,
  size = "rack",
  label,
}: {
  letter: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "rack" | "small";
  label?: string;
}) {
  const dims =
    size === "rack"
      ? "h-[2.6rem] w-[2.6rem] text-[1.35rem] sm:h-14 sm:w-14 sm:text-[1.75rem]"
      : "h-7 w-7 text-[0.95rem]";
  return (
    <button
      type="button"
      className={`${styles.tile} ${dims} uppercase`}
      onClick={onClick}
      disabled={disabled}
      tabIndex={onClick ? undefined : -1}
      aria-label={label ?? `${letter.toUpperCase()}, ${LETTER_VALUES[letter]} points`}
    >
      {letter}
      <span className={styles.tileValue} aria-hidden>
        {LETTER_VALUES[letter]}
      </span>
    </button>
  );
}

function LetterTiles({ day }: { day: string }) {
  const rack = useMemo(() => dailyRack(day), [day]);
  const storeKey = gameKey("tiles", day);
  const [game, setGame] = useState<Saved>(
    () => loadJSON<Saved>(storeKey) ?? { played: [], remaining: GAME_SECONDS, done: false },
  );
  const [running, setRunning] = useState(false);
  const [order, setOrder] = useState(() => Array.from({ length: RACK_SIZE }, (_, i) => i));
  const [picked, setPicked] = useState<number[]>([]);
  const [valid, setValid] = useState<Set<string> | null>(null);
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    let alive = true;
    loadValid()
      .then((s) => alive && setValid(s))
      .catch(() => alive && setMessage({ text: "Couldn't load the dictionary.", id: 0 }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    saveJSON(storeKey, game);
  }, [game, storeKey]);

  useTicker(running && !game.done, () => {
    setGame((g) => {
      const r = g.remaining - 1;
      return r <= 0 ? { ...g, remaining: 0, done: true } : { ...g, remaining: r };
    });
  });

  const active = running && !game.done;
  const total = game.played.reduce((s, p) => s + p.score, 0);
  const word = picked.map((i) => rack[i]).join("");
  const best = useMemo(() => (game.done && valid ? bestWords(valid, rack, 5) : []), [game.done, valid, rack]);

  function flash(text: string) {
    const id = Date.now();
    setMessage({ text, id });
    window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), 1600);
  }

  function pick(i: number) {
    if (!active || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
  }

  function unpick(pos: number) {
    if (!active) return;
    setPicked((p) => p.filter((_, k) => k !== pos));
  }

  function submit() {
    if (!active || !word) return;
    if (word.length < MIN_WORD) return flash(`Words need ${MIN_WORD}+ letters`);
    if (!valid) return flash("Loading the dictionary…");
    if (!valid.has(word)) return flash("Not in word list");
    if (game.played.some((p) => p.word === word)) return flash("Already played");
    const score = wordScore(word);
    setGame((g) => ({ ...g, played: [{ word, score }, ...g.played] }));
    setPicked([]);
    flash(word.length === RACK_SIZE ? `Bingo! +${score}` : `+${score}`);
  }

  function shuffleRack() {
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  function finish() {
    setGame((g) => ({ ...g, done: true }));
    setRunning(false);
    setPicked([]);
  }

  useKeyboard((e) => {
    if (!active) return;
    if (e.key === "Enter") submit();
    else if (e.key === "Backspace") setPicked((p) => p.slice(0, -1));
    else if (e.key === " ") shuffleRack();
    else if (/^[a-zA-Z]$/.test(e.key)) {
      const l = e.key.toLowerCase();
      const idx = order.find((i) => rack[i] === l && !picked.includes(i));
      if (idx !== undefined) pick(idx);
    } else return;
    e.preventDefault();
  });

  const lowTime = active && game.remaining <= 20;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <section className="flex flex-1 flex-col items-center" aria-label="Board">
        <div className="flex w-full max-w-[460px] items-center justify-between">
          <p className="font-label text-sm text-muted">
            Score <span className="text-lg font-semibold tabular-nums text-ink">{total}</span>
          </p>
          <p
            className={`flex items-center gap-1.5 font-label text-lg font-semibold tabular-nums ${
              lowTime ? "text-[#e5484d]" : "text-ink"
            }`}
            aria-label="Time left"
          >
            <Timer size={17} aria-hidden /> {formatClock(game.remaining)}
          </p>
        </div>

        <div className="relative mt-2 h-8 w-full">
          {message && (
            <div
              key={message.id}
              className={`glass-strong absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1 font-label text-sm font-semibold text-ink ${styles.toast}`}
              role="status"
            >
              {message.text}
            </div>
          )}
        </div>

        {/* The word being built: a wooden tray of seven slots. */}
        <div
          className="mt-2 flex min-h-[3.6rem] w-full max-w-[460px] items-center justify-center gap-1.5 rounded-2xl border border-rule bg-wash/70 px-2 py-2 sm:min-h-[4.6rem]"
          aria-label="Your word"
        >
          {picked.length === 0 ? (
            <span className="font-label text-sm text-muted">
              {game.done ? "Time's up" : active ? "Tap tiles to spell a word" : "Press start when you're ready"}
            </span>
          ) : (
            picked.map((ti, pos) => (
              <Tile
                key={`${ti}-${pos}`}
                letter={rack[ti]}
                onClick={() => unpick(pos)}
                label={`Remove ${rack[ti].toUpperCase()}`}
              />
            ))
          )}
        </div>
        {word && <p className="mt-1 font-label text-xs tabular-nums text-muted">{wordScore(word)} points</p>}

        {/* The rack. */}
        <div
          className="mt-6 flex items-center justify-center gap-1.5 rounded-xl px-3 pb-3 pt-2 shadow-[inset_0_-6px_0_rgba(90,55,20,0.45)]"
          style={{ background: "linear-gradient(180deg, #b07a43, #8a5a2b)" }}
          role="group"
          aria-label="Your rack"
        >
          {order.map((i) =>
            game.done || !running ? (
              <Tile key={i} letter={rack[i]} disabled={!game.done} />
            ) : (
              <Tile key={i} letter={rack[i]} onClick={() => pick(i)} disabled={picked.includes(i)} />
            ),
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {game.done ? null : !running ? (
            <button type="button" className="btn btn-primary" onClick={() => setRunning(true)}>
              <Play size={16} aria-hidden /> {game.remaining < GAME_SECONDS ? "Resume" : "Start the clock"}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-glass !px-3" onClick={shuffleRack} aria-label="Shuffle rack">
                <Shuffle size={17} aria-hidden />
              </button>
              <button type="button" className="btn btn-glass" onClick={() => setPicked([])} disabled={!picked.length}>
                <X size={16} aria-hidden /> Clear
              </button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={!picked.length}>
                Play word
              </button>
              <button type="button" className="btn btn-glass btn-sm" onClick={finish}>
                <Flag size={14} aria-hidden /> Finish
              </button>
            </>
          )}
        </div>
        <p className="mt-4 max-w-[420px] text-center font-label text-xs text-muted">
          Scrabble letter values. Words of {MIN_WORD}+ letters; use all seven tiles for a {BINGO_BONUS}-point bingo.
          You can type on a keyboard too.
        </p>
      </section>

      <aside className="w-full lg:w-[360px]" aria-label="Results">
        {game.done && (
          <div className="glass-card mb-4 rounded-3xl p-5" role="status">
            <h2 className="font-headline text-2xl font-semibold text-ink">Final score: {total}</h2>
            <p className="mt-1 font-body text-[15px] text-muted">
              {game.played.length} word{game.played.length === 1 ? "" : "s"} played. New rack tomorrow.
            </p>
            {best.length > 0 && (
              <div className="mt-4">
                <h3 className="font-label text-xs font-bold uppercase tracking-[0.14em] text-muted">Best possible</h3>
                <ul className="mt-2 space-y-1.5">
                  {best.map((b, i) => (
                    <li key={b.word} className="flex items-center justify-between gap-2">
                      <span className="flex gap-0.5">
                        {[...b.word].map((c, k) => (
                          <span key={k} className={`${styles.tile} h-7 w-7 text-[0.95rem] uppercase`}>
                            {c}
                            <span className={styles.tileValue}>{LETTER_VALUES[c]}</span>
                          </span>
                        ))}
                      </span>
                      <span className={`font-label text-sm tabular-nums ${i === 0 ? "font-bold text-accent" : "text-muted"}`}>
                        {b.score}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="glass-card rounded-3xl p-5">
          <h3 className="font-label text-xs font-bold uppercase tracking-[0.14em] text-muted">Played words</h3>
          {game.played.length === 0 ? (
            <p className="mt-2 font-body text-[15px] text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule">
              {game.played.map((p) => (
                <li key={p.word} className="flex items-center justify-between py-1.5">
                  <span className="font-body text-[16px] uppercase tracking-wide text-ink">{p.word}</span>
                  <span className="font-label text-sm tabular-nums text-muted">
                    {p.word.length === RACK_SIZE && <span className="mr-1 text-accent">Bingo</span>}+{p.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
