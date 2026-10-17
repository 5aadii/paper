// localStorage helpers for per-day game progress. Every access is wrapped: storage can be
// missing (private mode, blocked cookies) and the games must still work without it.

const PREFIX = "paper-games";

export function gameKey(game: string, day: string, extra?: string): string {
  return extra ? `${PREFIX}:${game}:${day}:${extra}` : `${PREFIX}:${game}:${day}`;
}

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: progress just won't persist.
  }
}
