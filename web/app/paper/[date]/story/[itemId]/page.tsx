// Story page: reading + active read-time tracking (SPEC Section 8.7).
import { notFound, redirect } from "next/navigation";
import StoryView, { type RelatedStory } from "@/components/StoryView";
import { isIsoDate, loadEdition, loadReadItemIds, loadStoryBody } from "@/lib/edition";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function StoryPage({ params, searchParams }: PageProps<"/paper/[date]/story/[itemId]">) {
  const { date, itemId } = await params;
  const sp = await searchParams;
  const from = sp?.from === "explore" ? "explore" : sp?.from === "today" ? "today" : "paper";
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

  // Related: same topic, from the reader's earlier editions (RLS keeps this to their own papers).
  let related: RelatedStory[] = [];
  if (item.topic) {
    const { data: eds } = await supabase
      .from("editions")
      .select("id")
      .eq("user_id", user.id)
      .neq("id", edition.edition_id)
      .order("edition_date", { ascending: false })
      .limit(14);
    const ids = (eds ?? []).map((e: any) => e.id);
    if (ids.length) {
      const { data } = await supabase
        .from("edition_items")
        .select("id, headline, editions(edition_date), articles(source_name, published_at)")
        .eq("topic", item.topic)
        .in("edition_id", ids)
        .limit(12);
      related = ((data ?? []) as any[])
        .filter((r) => r.editions?.edition_date)
        .map((r) => ({
          id: r.id,
          date: r.editions.edition_date,
          headline: r.headline,
          source: r.articles?.source_name ?? "",
          published_at: r.articles?.published_at ?? null,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4);
    }
  }
  const [readIds, story] = await Promise.all([
    loadReadItemIds(supabase, edition.edition_id),
    loadStoryBody(supabase, item.item_id),
  ]);

  return (
    <StoryView
      key={itemId}
      edition={edition}
      item={item}
      story={story}
      sectionName={section.name}
      readItemIds={readIds}
      from={from}
      related={related}
    />
  );
}
