// Letter Tiles: a daily Scrabble-style rack of seven tiles.
import { rngFrom, shuffle } from "./rng";

/** Official English Scrabble letter values. */
export const LETTER_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
};

/** Tile counts in a standard bag (the two blanks left out). */
const DISTRIBUTION: Record<string, number> = {
  a: 9, b: 2, c: 2, d: 4, e: 12, f: 2, g: 3, h: 2, i: 9, j: 1, k: 1, l: 4, m: 2,
  n: 6, o: 8, p: 2, q: 1, r: 6, s: 4, t: 6, u: 4, v: 2, w: 2, x: 1, y: 2, z: 1,
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const GAME_SECONDS = 180;
export const MIN_WORD = 3;

const BAG: string[] = Object.entries(DISTRIBUTION).flatMap(([l, n]) => Array<string>(n).fill(l));

export function dailyRack(day: string): string[] {
  const rng = rngFrom(`tiles:${day}`);
  for (;;) {
    const rack = shuffle(BAG, rng).slice(0, RACK_SIZE);
    const vowels = rack.filter((l) => VOWELS.has(l)).length;
    // At least two vowels, and at least two consonants so there is something to build with.
    if (vowels >= 2 && vowels <= 5) return rack;
  }
}

export function wordScore(word: string): number {
  let s = 0;
  for (const c of word) s += LETTER_VALUES[c] ?? 0;
  return s + (word.length === RACK_SIZE ? BINGO_BONUS : 0);
}

/** Whether the word can be spelled from the rack (each tile used at most once). */
export function canMake(word: string, rack: readonly string[]): boolean {
  const left: Record<string, number> = {};
  for (const l of rack) left[l] = (left[l] ?? 0) + 1;
  for (const c of word) {
    if (!left[c]) return false;
    left[c]--;
  }
  return true;
}

/** The highest-scoring dictionary words for a rack, best first. */
export function bestWords(words: Iterable<string>, rack: readonly string[], n = 5): { word: string; score: number }[] {
  const out: { word: string; score: number }[] = [];
  for (const w of words) {
    if (w.length < MIN_WORD || w.length > RACK_SIZE) continue;
    if (canMake(w, rack)) out.push({ word: w, score: wordScore(w) });
  }
  out.sort((a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word));
  return out.slice(0, n);
}
