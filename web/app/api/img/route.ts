// Image proxy for publisher photos (see lib/img.ts). Only public http(s) image URLs are fetched.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function isPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function safeUrl(raw: string | null): Promise<URL | null> {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

export async function GET(request: NextRequest) {
  // Only signed-in readers use the proxy (cheap cookie check; keeps it from being an open proxy).
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return new NextResponse(null, { status: 401 });
  }
  let url = await safeUrl(request.nextUrl.searchParams.get("u"));
  if (!url) return new NextResponse(null, { status: 400 });

  // Follow redirects by hand so every hop is checked.
  let res: Response | null = null;
  for (let hop = 0; hop < 4 && url; hop++) {
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: url.origin + "/" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return new NextResponse(null, { status: 502 });
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await safeUrl(new URL(res.headers.get("location")!, url).toString());
      res = null;
      continue;
    }
    break;
  }
  if (!res || !res.ok || !res.body) return new NextResponse(null, { status: 502 });
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/") || type.includes("svg")) return new NextResponse(null, { status: 415 });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return new NextResponse(null, { status: 413 });

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new NextResponse(null, { status: 413 });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
