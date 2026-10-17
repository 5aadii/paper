"use client";
// "Daily · Saturday, October 17": the server's date first, then the reader's own once mounted.
import { prettyDay } from "@/lib/games/rng";
import { useClientDay } from "./hooks";

export default function DailyDate({ fallback }: { fallback: string }) {
  const day = useClientDay() ?? fallback;
  return (
    <p className="font-label text-xs font-bold uppercase tracking-[0.16em] text-accent">
      Daily <span className="text-muted">· {prettyDay(day)}</span>
    </p>
  );
}
