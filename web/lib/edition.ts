/**
 * loadEdition(supabase, userId, date) → the Section 5.2 Edition contract, plus small date helpers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LayoutRole = "lead" | "feature" | "standard" | "brief";

export type EditionItem = {
  item_id: string;
  layout_role: LayoutRole;
  headline: string;
  dek: string;
  summary: string;
  key_points: string[];
  why_this: string;
  source_name: string;
  published_at: string | null;
  url: string;
  image_url: string | null;
  topic: string | null;
  is_explore: boolean;
  word_count?: number | null;
};

/** The full text of one story, loaded only on its story page (kept off the front page payload). */
export type StoryBody = { body: string | null; author: string | null; word_count: number | null };

export type Edition = {
  edition_id: string;
  paper_name: string;
  reader_name: string;
  edition_date: string;
  edition_number: number;
  reading_style: string;
  editors_note: string;
  ai_status: "pending" | "success" | "fallback";
  three_things: { text: string; item_id: string }[];
  sections: { name: string; items: EditionItem[] }[];
};

export type EditionRow = {
  id: string;
  user_id: string;
  edition_date: string;
  edition_number: number;
  status: "generating" | "ready" | "failed";
  progress: string | null;
  editors_note: string | null;
  three_things: { text: string; item_id: string }[] | null;
  ai_status: "pending" | "success" | "fallback";
};

export type Profile = {
  id: string;
  display_name: string | null;
  paper_name: string;
  region: string;
  reading_style: string;
  timezone: string;
  onboarded: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadEdition(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ row: EditionRow | null; edition: Edition | null; profile: Profile | null }> {
  const [{ data: row }, { data: profile }] = await Promise.all([
    supabase.from("editions").select("*").eq("user_id", userId).eq("edition_date", date).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  if (!row || row.status !== "ready") return { row: row ?? null, edition: null, profile: profile ?? null };

  const { data: items } = await supabase
    .from("edition_items")
    .select("*, articles(url, source_name, published_at, image_url, word_count)")
    .eq("edition_id", row.id)
    .order("section_position")
    .order("position");

  const sections: Edition["sections"] = [];
  for (const it of (items ?? []) as any[]) {
    const a = it.articles ?? {};
    if (!sections.length || sections[sections.length - 1].name !== it.section) {
      sections.push({ name: it.section, items: [] });
    }
    sections[sections.length - 1].items.push({
      item_id: it.id,
      layout_role: it.layout_role,
      headline: it.headline,
      dek: it.dek ?? "",
      summary: it.summary ?? "",
      key_points: Array.isArray(it.key_points) ? it.key_points : [],
      why_this: it.why_this ?? "",
      source_name: a.source_name ?? "",
      published_at: a.published_at ?? null,
      url: a.url ?? "",
      image_url: a.image_url ?? null,
      topic: it.topic ?? null,
      is_explore: !!it.is_explore,
      word_count: a.word_count ?? null,
    });
  }

  return {
    row,
    profile: profile ?? null,
    edition: {
      edition_id: row.id,
      paper_name: profile?.paper_name ?? "The Morning Edition",
      reader_name: profile?.display_name ?? "Reader",
      edition_date: row.edition_date,
      edition_number: row.edition_number,
      reading_style: profile?.reading_style ?? "balanced",
      editors_note: row.editors_note ?? "",
      ai_status: row.ai_status,
      three_things: Array.isArray(row.three_things) ? row.three_things : [],
      sections,
    },
  };
}

export async function loadStoryBody(supabase: SupabaseClient, itemId: string): Promise<StoryBody> {
  const { data } = await supabase
    .from("edition_items")
    .select("articles(body, author, word_count)")
    .eq("id", itemId)
    .maybeSingle();
  const a = ((data as any)?.articles ?? {}) as Partial<StoryBody>;
  return { body: a.body || null, author: a.author || null, word_count: a.word_count ?? null };
}

/** Item ids this reader has opened in an edition (for READ tags). */
export async function loadReadItemIds(supabase: SupabaseClient, editionId: string): Promise<string[]> {
  const { data } = await supabase
    .from("events")
    .select("item_id")
    .eq("edition_id", editionId)
    .eq("event_type", "open");
  return Array.from(new Set((data ?? []).map((r: any) => r.item_id).filter(Boolean)));
}

/** Today's date (YYYY-MM-DD) in the reader's time zone. */
export function todayIn(timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "Asia/Karachi" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  }
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** "Saturday, 17 October 2026" */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `${weekday}, ${rest}`;
}

/** "17 Oct" */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "3h ago" */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 48) return `${Math.floor(hours)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function sectionAnchor(name: string): string {
  return "sec-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
