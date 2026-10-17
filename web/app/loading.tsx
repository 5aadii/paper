// Shown while a page's data loads: a quiet skeleton of a front page.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 animate-pulse px-4 pt-6 md:px-6" aria-busy="true" aria-label="Loading">
      <div className="mx-auto h-14 w-2/3 max-w-xl bg-wash md:h-20" />
      <div className="mt-4 h-px bg-rule-strong" />
      <div className="mt-2 h-4 w-1/3 bg-wash" />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="aspect-[16/9] w-full bg-wash" />
          <div className="h-10 w-11/12 bg-wash" />
          <div className="h-10 w-3/4 bg-wash" />
          <div className="h-5 w-2/3 bg-wash" />
        </div>
        <div className="space-y-3 lg:col-span-4">
          <div className="h-8 w-1/2 bg-wash" />
          <div className="h-28 bg-wash" />
          <div className="h-40 bg-wash" />
        </div>
      </div>
    </main>
  );
}
