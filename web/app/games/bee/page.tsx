// Spelling Hive: Make words of four or more letters. Every word must use the centre letter.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameHeader from "@/components/games/GameHeader";
import SpellingHiveGame from "@/components/games/SpellingHive";

export const metadata = { title: "Spelling Hive" };

export default async function SpellingHiveGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <GameHeader title="Spelling Hive" blurb="Make words of four or more letters. Every word must use the centre letter." />
      <SpellingHiveGame />
    </main>
  );
}
