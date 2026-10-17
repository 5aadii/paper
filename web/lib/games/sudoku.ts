// Sudoku generator and helpers. Grids are flat arrays of 81 numbers, 0 = empty.
// Puzzles are made by filling a random solved grid, then removing clues in symmetric
// pairs as long as the puzzle still has exactly one solution.
import { rngFrom, shuffle, type Rng } from "./rng";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Target number of givens for each difficulty (fewer clues = harder). */
const TARGET_CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 25 };

export type Puzzle = { givens: number[]; solution: number[]; difficulty: Difficulty };

export const row = (i: number) => Math.floor(i / 9);
export const col = (i: number) => i % 9;
export const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

/** Indices of the 20 cells that share a row, column or box with cell i. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) out.push(j);
  }
  return out;
});

const ALL = 0x3fe; // bits 1..9

function candidates(grid: number[], i: number): number {
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << grid[p];
  return ALL & ~used;
}

function bitCount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

/** Counts solutions up to `limit` (stops early). Uses most-constrained-cell-first search. */
export function countSolutions(input: readonly number[], limit = 2): number {
  const grid = [...input];
  let count = 0;
  const solve = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const m = candidates(grid, i);
      const c = bitCount(m);
      if (c === 0) return false;
      if (c < bestCount) {
        best = i;
        bestMask = m;
        bestCount = c;
        if (c === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return count >= limit;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue;
      grid[best] = d;
      if (solve()) return true;
    }
    grid[best] = 0;
    return false;
  };
  solve();
  return count;
}

function solvedGrid(rng: Rng): number[] {
  const grid = new Array<number>(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const m = candidates(grid, i);
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (!(m & (1 << d))) continue;
      grid[i] = d;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

export function generate(rng: Rng, difficulty: Difficulty): Puzzle {
  const solution = solvedGrid(rng);
  const givens = [...solution];
  const target = TARGET_CLUES[difficulty];
  let clues = 81;
  // Visit the 41 symmetric pairs (cell i and its 180° partner 80 - i) in random order.
  const order = shuffle(Array.from({ length: 41 }, (_, i) => i), rng);
  for (const i of order) {
    if (clues <= target) break;
    const j = 80 - i;
    const saved = [givens[i], givens[j]];
    givens[i] = 0;
    givens[j] = 0;
    const removed = i === j ? 1 : 2;
    if (clues - removed < target - 1 || countSolutions(givens, 2) !== 1) {
      givens[i] = saved[0];
      givens[j] = saved[1];
    } else {
      clues -= removed;
    }
  }
  return { givens, solution, difficulty };
}

/** Today's puzzle for a difficulty: the same for everyone on the same date. */
export function dailyPuzzle(day: string, difficulty: Difficulty): Puzzle {
  return generate(rngFrom(`sudoku:${day}:${difficulty}`), difficulty);
}

/** Cells whose value clashes with another value in the same row, column or box. */
export function conflicts(values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = values[i];
    if (!v) continue;
    for (const p of PEERS[i]) {
      if (values[p] === v) {
        out.add(i);
        break;
      }
    }
  }
  return out;
}
