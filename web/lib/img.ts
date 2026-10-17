/**
 * Route publisher photos through our own /api/img proxy. Many news sites block images that are
 * embedded on other domains (hotlink protection) or still serve them over plain http, which is
 * why photos often failed to appear. The proxy fetches them server-side and caches them.
 */
export function photo(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return `/api/img?u=${encodeURIComponent(url)}`;
}
