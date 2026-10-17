"use client";
/**
 * Active reading-time hook for the story page (SPEC Section 8.7).
 *
 * Counts a second only while the tab is visible AND the reader did something
 * (scroll, mouse move, key press, touch, wheel) in the last 30 seconds.
 * Sends ONE read_time event (capped at 600 s) on unmount, pagehide, or after
 * the tab has been hidden for more than 60 seconds.
 */
import { useEffect, useRef } from "react";
import { logEvent } from "./events";

const IDLE_MS = 30_000;
const HIDDEN_LIMIT_MS = 60_000;

export function useReadTimer(item: {
  editionId: string;
  itemId: string;
  topic: string | null;
  sourceName: string | null;
}): void {
  const { editionId, itemId, topic, sourceName } = item;
  const activeSeconds = useRef(0);
  const lastActivity = useRef(0); // set when the effect starts
  const sent = useRef(false);

  useEffect(() => {
    activeSeconds.current = 0;
    lastActivity.current = Date.now();
    sent.current = false;

    const send = () => {
      if (sent.current) return;
      sent.current = true;
      const value = Math.min(activeSeconds.current, 600);
      if (value <= 0) return;
      logEvent({ editionId, itemId, topic, sourceName, type: "read_time", value });
    };

    let lastMark = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastMark < 500) return; // throttle
      lastMark = now;
      lastActivity.current = now;
    };

    const tick = window.setInterval(() => {
      if (sent.current) return;
      const visible = document.visibilityState === "visible";
      if (visible && Date.now() - lastActivity.current < IDLE_MS) {
        activeSeconds.current += 1;
      }
    }, 1000);

    let hiddenTimer: number | undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer = window.setTimeout(send, HIDDEN_LIMIT_MS);
      } else {
        window.clearTimeout(hiddenTimer);
        lastActivity.current = Date.now();
      }
    };

    const events: (keyof WindowEventMap)[] = ["scroll", "mousemove", "keydown", "touchstart", "wheel"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hiddenTimer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [editionId, itemId, topic, sourceName]);
}
