/**
 * logEvent() — fire-and-forget POST /api/events with keepalive (SPEC Section 8.7).
 * Swallows all errors; never blocks or throws to the UI.
 */
export type EventType =
  | "open"
  | "read_time"
  | "click_through"
  | "like"
  | "dislike"
  | "skip"
  | "quiz_correct"
  | "quiz_wrong";

export function logEvent(e: {
  editionId: string;
  itemId: string;
  topic: string | null;
  sourceName: string | null;
  type: EventType;
  value?: number;
}): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never surface logging failures to the reader
  }
}
