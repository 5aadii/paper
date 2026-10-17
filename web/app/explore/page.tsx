// Explore: stories from outside your usual topics, and topics you could follow.
import { redirect } from "next/navigation";
import FollowTopics from "@/components/FollowTopics";
import TrackedStoryLink from "@/components/TrackedStoryLink";
import { timeAgo } from "@/lib/edition";
import { photo } from "@/lib/img";
import { createClient } from "@/lib/supabase/server";
import { TOPICS, topicLabel } from "@/lib/topics";

export const metadata = { title: "Explore · The Morning Edition" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ExplorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: eds }, { data: interests }] = await Promise.all([
    supabase.from("editions").select("id").eq("user_id", user.id).order("edition_date", { ascending: false }).limit(14),
    supabase.from("interests").select("topic").eq("user_id", user.id),
  ]);
  const edIds = (eds ?? []).map((e: any) => e.id);
  const { data: items } = edIds.length
    ? await supabase
        .from("edition_items")
        .select("id, edition_id, headline, dek, topic, editions(edition_date), articles(source_name, image_url, published_at)")
        .eq("is_explore", true)
        .in("edition_id", edIds)
    : { data: [] };
  const followed = new Set((interests ?? []).map((i: any) => i.topic));
  const stories = ((items ?? []) as any[])
    .filter((s) => s.editions?.edition_date)
    .sort((a, b) => String(b.editions.edition_date).localeCompare(String(a.editions.edition_date)))
    .slice(0, 18);
  const unfollowed = TOPICS.filter((t) => !followed.has(t.slug)).map((t) => ({ slug: t.slug, label: t.label }));

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-20 pt-8 md:px-6">
      <p className="font-label text-xs uppercase tracking-widest text-accent">Explore</p>
      <h1 className="mt-1 font-headline text-4xl font-semibold md:text-5xl">Something new</h1>
      <p className="mt-2 max-w-2xl font-body text-lg italic text-muted">
        Every edition slips in a story from outside your usual topics. Read or like one, and your paper learns a new interest.
      </p>

      <section className="mt-8 border-t-[3px] border-rule-strong pt-3">
        <h2 className="font-label text-xs font-bold uppercase tracking-widest">Topics you don&rsquo;t follow yet</h2>
        <FollowTopics userId={user.id} topics={unfollowed} />
      </section>

      <section className="mt-10 border-t-[3px] border-rule-strong pt-3">
        <h2 className="font-label text-xs font-bold uppercase tracking-widest">Recent Explore stories</h2>
        {stories.length === 0 ? (
          <p className="py-10 font-body text-lg italic text-muted">Explore stories will appear here as your editions are printed.</p>
        ) : (
          <ul className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => (
              <li key={s.id} className="border-b border-ink/20 pb-5">
                <TrackedStoryLink
                  href={`/paper/${s.editions.edition_date}/story/${s.id}?from=explore`}
                  event={{ editionId: s.edition_id, itemId: s.id, topic: s.topic, sourceName: s.articles?.source_name ?? null }}
                  className="group block"
                >
                  {s.articles?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo(s.articles.image_url)!} alt="" referrerPolicy="no-referrer" loading="lazy" className="mb-3 aspect-[3/2] w-full object-cover" />
                  )}
                  <p className="font-label text-xs font-semibold uppercase tracking-widest text-accent">{topicLabel(s.topic)}</p>
                  <h3 className="mt-1 font-headline text-xl font-bold leading-snug group-hover:underline group-hover:decoration-accent">{s.headline}</h3>
                  {s.dek && <p className="mt-1 font-body italic text-ink/80">{s.dek}</p>}
                  <p className="mt-2 font-label text-xs uppercase tracking-widest text-muted">
                    {s.articles?.source_name} {s.articles?.published_at && `· ${timeAgo(s.articles.published_at)}`}
                  </p>
                </TrackedStoryLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
