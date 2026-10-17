// Connections: Find the four groups of four that share something in common.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameHeader from "@/components/games/GameHeader";
import ConnectionsGame from "@/components/games/Connections";

export const metadata = { title: "Connections" };

export default async function ConnectionsGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-8 md:px-6">
      <GameHeader title="Connections" blurb="Find the four groups of four that share something in common." />
      <ConnectionsGame />
    </main>
  );
}
