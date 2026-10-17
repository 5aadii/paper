// Games hub: the daily puzzles, NYT-Games style.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Grid3x3, Hexagon, LayoutGrid, WholeWord, Dices, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DailyDate from "@/components/games/DailyDate";
import { serverToday } from "@/lib/games/today";

export const metadata = { title: "Games" };

type Game = { href: string; name: string; blurb: string; icon: LucideIcon; tint: string };

const GAMES: Game[] = [
  { href: "/games/wordle", name: "Wordplay", blurb: "Guess the five-letter word in six tries.", icon: WholeWord, tint: "#6aaa64" },
  { href: "/games/connections", name: "Connections", blurb: "Sort sixteen words into four hidden groups.", icon: LayoutGrid, tint: "#ba81c5" },
  { href: "/games/bee", name: "Spelling Hive", blurb: "How many words can you make with seven letters?", icon: Hexagon, tint: "#e5b800" },
  { href: "/games/sudoku", name: "Sudoku", blurb: "The classic number puzzle, in three difficulties.", icon: Grid3x3, tint: "#0a84ff" },
  { href: "/games/tiles", name: "Letter Tiles", blurb: "Seven Scrabble tiles, three minutes, top score wins.", icon: Dices, tint: "#b07a43" },
];

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <header className="mb-8">
        <DailyDate fallback={serverToday()} />
        <h1 className="mt-2 font-headline text-[40px] font-semibold leading-[1.05] tracking-tight text-ink md:text-[56px]">
          Games
        </h1>
        <p className="mt-2 max-w-[560px] font-body text-[17px] text-muted">
          A fresh set of puzzles every morning. Your progress is saved on this device.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map(({ href, name, blurb, icon: Icon, tint }) => (
          <li key={href}>
            <Link
              href={href}
              className="glass-card group flex h-full items-center gap-4 rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_16px_-6px_rgba(0,0,0,0.35)]"
                style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${tint} 75%, #fff), ${tint})` }}
                aria-hidden
              >
                <Icon size={28} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-headline text-[22px] font-semibold leading-tight text-ink">{name}</span>
                <span className="mt-0.5 block font-body text-[15px] leading-snug text-muted">{blurb}</span>
              </span>
              <ChevronRight className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" size={20} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
