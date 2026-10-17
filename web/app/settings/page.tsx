// Settings / Account: names, reading style, email, password, sign out.
import { redirect } from "next/navigation";
import SettingsPanel from "@/components/SettingsPanel";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings · The Morning Edition" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, paper_name, reading_style, region, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"];
  return (
    <SettingsPanel
      userId={user.id}
      email={user.email ?? ""}
      emailConfirmed={!!user.email_confirmed_at}
      providers={providers}
      joined={profile?.created_at ?? user.created_at}
      initial={{
        displayName: profile?.display_name ?? "",
        paperName: profile?.paper_name ?? "The Morning Edition",
        readingStyle: (profile?.reading_style as "quick" | "balanced" | "deep") ?? "balanced",
        region: (profile?.region as "pakistan" | "global" | "both") ?? "both",
      }}
    />
  );
}
