// Server-side fallback for "today" (YYYY-MM-DD). Games use the reader's local date once
// they mount in the browser; this is only for server-rendered text such as the hub's date line.
import { isoDay } from "./rng";

export function serverToday(): string {
  return isoDay(new Date());
}
