// Sudoku: Fill the grid so every row, column and box has 1 to 9.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameHeader from "@/components/games/GameHeader";
import SudokuGame from "@/components/games/Sudoku";

export const metadata = { title: "Sudoku" };

export default async function SudokuGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <GameHeader title="Sudoku" blurb="Fill the grid so every row, column and box has 1 to 9." />
      <SudokuGame />
    </main>
  );
}
