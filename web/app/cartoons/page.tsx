// Cartoons: today's editorial cartoons from several newspapers, gathered by the engine.
import { redirect } from "next/navigation";
import CartoonGallery, { type Cartoon } from "@/components/CartoonGallery";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cartoons" };

async function loadCartoons(): Promise<Cartoon[] | null> {
  try {
    const res = await fetch(`${process.env.ENGINE_URL}/cartoons`, {
      headers: { "X-Service-Key": process.env.SERVICE_SHARED_SECRET ?? "" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { cartoons: Cartoon[] }).cartoons;
  } catch {
    return null;
  }
}

export default async function CartoonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cartoons = await loadCartoons();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pt-8 md:px-6">
      <p className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-muted">{today}</p>
      <h1 className="mt-1 font-headline text-4xl font-semibold tracking-tight md:text-5xl">Today&rsquo;s cartoons</h1>
      <p className="mt-2 max-w-2xl font-body text-lg text-muted">
        The day&rsquo;s editorial cartoons from newspapers around the world. Tap one to see it full size.
      </p>
      {cartoons === null ? (
        <p className="glass-card mt-8 px-5 py-4 font-body">
          The cartoon desk can&rsquo;t be reached right now. Make sure the engine is running, then refresh.
        </p>
      ) : cartoons.length === 0 ? (
        <p className="glass-card mt-8 px-5 py-4 font-body">No cartoons have come in yet today. Check back later.</p>
      ) : (
        <CartoonGallery cartoons={cartoons} />
      )}
    </main>
  );
}
