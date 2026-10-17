"use client";
// Client-side hooks shared by the games.
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { isoDay } from "@/lib/games/rng";

function subscribeDay(onChange: () => void): () => void {
  // Re-check the date when the tab comes back (e.g. the phone was asleep over midnight).
  document.addEventListener("visibilitychange", onChange);
  const t = window.setInterval(onChange, 60_000);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.clearInterval(t);
  };
}

/**
 * The reader's local date (YYYY-MM-DD), or null during server render and hydration.
 * Games render a placeholder while it is null, then mount with the right day; this keeps
 * localStorage reads out of the server render and avoids hydration mismatches.
 */
export function useClientDay(): string | null {
  return useSyncExternalStore(
    subscribeDay,
    () => isoDay(new Date()),
    () => null,
  );
}

/** A one-second ticker: calls `tick` every second while `running` is true. */
export function useTicker(running: boolean, tick: () => void): void {
  const onTick = useEffectEvent(tick);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => onTick(), 1000);
    return () => window.clearInterval(t);
  }, [running]);
}

/** Calls `handler` for physical key presses (ignored while typing in a form field). */
export function useKeyboard(handler: (e: KeyboardEvent) => void): void {
  const onKey = useEffectEvent(handler);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      onKey(e);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
