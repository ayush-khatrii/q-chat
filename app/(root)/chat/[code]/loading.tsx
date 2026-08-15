export default function RoomLoading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" aria-busy="true">
      <div className="border-b bg-background/95">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-2 py-2 sm:min-h-16 sm:px-4 lg:px-8">
          <div className="size-8 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="size-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-end gap-5 px-3 py-6 sm:px-5">
        <div className="h-14 w-48 animate-pulse rounded-2xl rounded-bl-md bg-muted" />
        <div className="ml-auto h-14 w-56 animate-pulse rounded-2xl rounded-br-md bg-muted" />
      </div>

      <div className="border-t px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-2xl bg-muted" />
          <div className="size-11 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
