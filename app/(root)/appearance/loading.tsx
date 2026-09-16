export default function AppearanceLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-background"
      aria-busy="true"
    >
      <div className="border-b bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 lg:px-8">
          <div className="size-8 animate-pulse rounded-md bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="ml-auto h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r p-4 lg:block">
          <div className="space-y-2">
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-9 animate-pulse rounded-md bg-muted" />
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto">
          <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:p-6">
            <section className="space-y-5">
              <div className="h-11 animate-pulse rounded-xl bg-muted" />
              <div className="h-44 animate-pulse rounded-2xl border bg-card" />
              <div className="h-32 animate-pulse rounded-2xl border bg-card" />
            </section>

            <section className="min-h-[520px] animate-pulse rounded-3xl border bg-card" />
          </div>
        </main>
      </div>
    </div>
  );
}
