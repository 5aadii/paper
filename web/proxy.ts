/**
 * Refresh the Supabase session and protect routes (SPEC Section 8.2).
 * Next.js 16 renamed middleware.ts to proxy.ts (SPEC Section 8.2 calls it middleware).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/today", "/games", "/cartoons", "/archive", "/paper", "/interests", "/onboarding", "/explore", "/assistant", "/settings", "/story"];
const AUTH_PAGES = ["/", "/login", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api")) return response;

  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthPage = AUTH_PAGES.includes(path);

  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    return isProtected ? redirectTo("/login") : response;
  }

  if (isProtected || isAuthPage) {
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
    const onboarded = !!profile?.onboarded;
    if (!onboarded && path !== "/onboarding") return redirectTo("/onboarding");
    if (onboarded && isAuthPage) return redirectTo("/today");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/img|favicon.ico|.*\\.(?:json|svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
