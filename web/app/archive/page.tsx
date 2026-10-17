// Archive of past editions, styled like a newspaper rack (SPEC Section 8.9).
import Link from "next/link";
import { redirect } from "next/navigation";
import { longDate } from "@/lib/edition";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Archive · The Morning Edition" };

type Row = {
  id: string;
  edition_date: string;
  edition_number: number;
  status: string;
  edition_items: { headline: string; layout_role: string }[];
};

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("paper_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("editions")
      .select("id, edition_date, edition_number, status, edition_items(headline, layout_role)")
      .eq("user_id", user.id)
      .order("edition_date", { ascending: false }),
  ]);
  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between border-b border-rule pb-2 font-label text-xs uppercase tracking-widest">
        <Link href="/today" className="hover:text-accent">‹ Today&rsquo;s paper</Link>
        <Link href="/interests" className="hover:text-accent">Your interests</Link>
      </div>
      <h1 className="mt-8 font-headline text-5xl font-semibold">The Archive</h1>
      <p className="mt-2 font-body text-lg italic text-muted">Every edition of {profile?.paper_name ?? "your paper"}.</p>
      <div className="mt-6 border-t-[3px] border-rule-strong" />
      {rows.length === 0 ? (
        <p className="py-16 text-center font-body text-xl italic text-muted">
          Your first paper is being printed. Come back tomorrow for the next one.
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {rows.map((r) => {
            const lead = r.edition_items.find((i) => i.layout_role === "lead");
            return (
              <li key={r.id} className="grid gap-2 py-5 md:grid-cols-[180px_1fr_auto] md:items-center md:gap-6">
                <div className="font-label text-xs uppercase tracking-widest">
                  <div className="font-bold">No. {r.edition_number}</div>
                  <div className="text-muted">{longDate(r.edition_date)}</div>
                </div>
                <div>
                  <p className="font-headline text-2xl font-bold leading-tight">
                    {lead?.headline ?? (r.status === "ready" ? "Edition" : r.status === "failed" ? "The press jammed" : "Printing…")}
                  </p>
                  <p className="mt-1 font-label text-xs uppercase tracking-widest text-muted">
                    {r.edition_items.length} stories
                  </p>
                </div>
                {r.status === "ready" && (
                  <div className="flex gap-3 font-label text-xs uppercase tracking-widest">
                    <Link href={`/paper/${r.edition_date}`} className="btn btn-glass btn-sm">
                      Read
                    </Link>
                    <a href={`/api/pdf/${r.id}`} className="btn btn-glass btn-sm">
                      PDF
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
