// Story page: reading + active read-time tracking (SPEC Section 8.7).
import { notFound, redirect } from "next/navigation";
import StoryView from "@/components/StoryView";
import { isIsoDate, loadEdition, loadReadItemIds } from "@/lib/edition";
import { createClient } from "@/lib/supabase/server";

export default async function StoryPage({ params }: PageProps<"/paper/[date]/story/[itemId]">) {
  const { date, itemId } = await params;
  if (!isIsoDate(date)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { edition } = await loadEdition(supabase, user.id, date);
  if (!edition) notFound();
  const section = edition.sections.find((s) => s.items.some((it) => it.item_id === itemId));
  const item = section?.items.find((it) => it.item_id === itemId);
  if (!section || !item) notFound();
  const readIds = await loadReadItemIds(supabase, edition.edition_id);

  return <StoryView key={itemId} edition={edition} item={item} sectionName={section.name} readItemIds={readIds} />;
}
