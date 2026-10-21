export default function ContentFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-5 sm:px-5"
      aria-busy="true"
      aria-label="Loading content"
    >
      <div className="h-5 w-28 animate-pulse rounded-md bg-muted/80" />
      <div className="h-3.5 w-52 animate-pulse rounded bg-muted/70" />
      <div className="mt-2 h-52 w-full animate-pulse rounded-2xl bg-muted/80" />
    </div>
  );
}
