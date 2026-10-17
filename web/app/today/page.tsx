// Today's paper: printing screen while generating, else the front page (SPEC Sections 2.2, 8.5, 8.6).
import { redirect } from "next/navigation";
import FrontPage from "@/components/FrontPage";
import PrintingScreen from "@/components/PrintingScreen";
import { loadEdition, loadReadItemIds, todayIn } from "@/lib/edition";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Today · The Morning Edition" };

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  const date = todayIn(p?.timezone);
  const { row, edition, profile } = await loadEdition(supabase, user.id, date);

  if (!row || row.status !== "ready" || !edition) {
    return (
      <PrintingScreen
        paperName={profile?.paper_name ?? "The Morning Edition"}
        readerName={profile?.display_name ?? "you"}
        date={date}
        editionNumber={row?.edition_number ?? "—"}
        initialStatus={row ? (row.status === "failed" ? "failed" : "generating") : "none"}
        initialProgress={row?.progress ?? null}
      />
    );
  }
  const readIds = await loadReadItemIds(supabase, edition.edition_id);
  return <FrontPage edition={edition} readItemIds={readIds} isToday />;
}
