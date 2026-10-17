// Short story link: /story/<item-id> → the story's page inside its edition.
// RLS means a reader can only resolve stories from their own papers.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StoryShortLink({ params }: PageProps<"/story/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("edition_items").select("id, editions(edition_date)").eq("id", id).maybeSingle();
  const date = (data?.editions as unknown as { edition_date?: string } | null)?.edition_date;
  if (!date) notFound();
  redirect(`/paper/${date}/story/${id}`);
}
