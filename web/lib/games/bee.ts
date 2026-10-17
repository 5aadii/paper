// Spelling Hive (a Spelling Bee-style game). The daily puzzle is built in the browser from the
// common-word list: pick a pangram (a word with exactly 7 distinct letters), then a centre letter
// that gives a good number of answers.
import { rngFrom, shuffle } from "./rng";

export type BeePuzzle = {
  center: string;
  outer: string[]; // the six other letters
  pangram: string;
  answers: string[];
  maxScore: number;
};

const MIN_ANSWERS = 20;
const MAX_ANSWERS = 70;

function letterSet(w: string): Set<string> {
  return new Set(w);
}

/** Answers for a letter set: ≥4 letters, only those letters, and the centre letter at least once. */
export function answersFor(words: readonly string[], letters: Set<string>, center: string): string[] {
  return words.filter((w) => {
    if (w.length < 4 || !w.includes(center)) return false;
    for (const c of w) if (!letters.has(c)) return false;
    return true;
  });
}

export function isPangram(word: string, letters: readonly string[]): boolean {
  return letters.every((l) => word.includes(l));
}

export function wordScore(word: string, letters: readonly string[]): number {
  const base = word.length === 4 ? 1 : word.length;
  return base + (isPangram(word, letters) ? 7 : 0);
}

export function buildPuzzle(words: readonly string[], seed: string): BeePuzzle {
  const rng = rngFrom(`hive:${seed}`);
  // Like the original, avoid S (it makes plurals too easy).
  const pangrams = words.filter((w) => w.length <= 9 && !w.includes("s") && letterSet(w).size === 7);
  const seen = new Set<string>();
  let fallback: BeePuzzle | null = null;
  for (const p of shuffle(pangrams, rng)) {
    const key = [...letterSet(p)].sort().join("");
    if (seen.has(key)) continue;
    seen.add(key);
    const letters = letterSet(p);
    for (const center of shuffle([...letters], rng)) {
      const answers = answersFor(words, letters, center);
      const all = [...letters];
      const puzzle: BeePuzzle = {
        center,
        outer: all.filter((l) => l !== center),
        pangram: p,
        answers,
        maxScore: answers.reduce((s, w) => s + wordScore(w, all), 0),
      };
      if (answers.length >= MIN_ANSWERS && answers.length <= MAX_ANSWERS) return puzzle;
      if (!fallback || answers.length > fallback.answers.length) fallback = puzzle;
    }
    if (seen.size > 400 && fallback) break;
  }
  if (!fallback) throw new Error("No pangram found");
  return fallback;
}

export const RANKS: { name: string; pct: number }[] = [
  { name: "Beginner", pct: 0 },
  { name: "Good Start", pct: 2 },
  { name: "Moving Up", pct: 5 },
  { name: "Good", pct: 8 },
  { name: "Solid", pct: 15 },
  { name: "Nice", pct: 25 },
  { name: "Great", pct: 40 },
  { name: "Amazing", pct: 50 },
  { name: "Genius", pct: 70 },
];

export function rankThresholds(maxScore: number): number[] {
  return RANKS.map((r) => Math.round((r.pct / 100) * maxScore));
}

export function rankIndex(score: number, maxScore: number): number {
  const t = rankThresholds(maxScore);
  let idx = 0;
  for (let i = 0; i < t.length; i++) if (score >= t[i]) idx = i;
  return idx;
}
