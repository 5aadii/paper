// Front page of any edition by date (SPEC Section 8.6).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FrontPage from "@/components/FrontPage";
import { isIsoDate, loadEdition, loadReadItemIds, todayIn } from "@/lib/edition";
import { createClient } from "@/lib/supabase/server";

export default async function PaperByDate({ params }: PageProps<"/paper/[date]">) {
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { row, edition, profile } = await loadEdition(supabase, user.id, date);
  const isToday = date === todayIn(profile?.timezone);
  if (row && row.status !== "ready" && isToday) redirect("/today");
  if (!edition) {
    return (
      <main className="mx-auto max-w-xl flex-1 px-4 py-24 text-center">
        <h1 className="font-headline text-4xl font-bold">No paper for this date</h1>
        <p className="mt-4 font-body text-lg text-muted">There is no edition on file for {date}.</p>
        <Link href="/archive" className="mt-6 inline-block font-label text-xs uppercase tracking-widest text-accent underline">
          Back to the archive
        </Link>
      </main>
    );
  }
  const readIds = await loadReadItemIds(supabase, edition.edition_id);
  return <FrontPage edition={edition} readItemIds={readIds} isToday={isToday} />;
}
