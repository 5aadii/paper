// Wordplay: Guess the hidden five-letter word in six tries.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameHeader from "@/components/games/GameHeader";
import WordplayGame from "@/components/games/Wordplay";

export const metadata = { title: "Wordplay" };

export default async function WordplayGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <GameHeader title="Wordplay" blurb="Guess the hidden five-letter word in six tries." />
      <WordplayGame />
    </main>
  );
}
