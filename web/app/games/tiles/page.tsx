// Letter Tiles: Spell as many words as you can from today's rack in three minutes.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameHeader from "@/components/games/GameHeader";
import LetterTilesGame from "@/components/games/LetterTiles";

export const metadata = { title: "Letter Tiles" };

export default async function LetterTilesGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <GameHeader title="Letter Tiles" blurb="Spell as many words as you can from today's rack in three minutes." />
      <LetterTilesGame />
    </main>
  );
}
