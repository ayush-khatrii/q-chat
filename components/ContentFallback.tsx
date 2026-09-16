export default function ContentFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-6 sm:px-5"
      aria-busy="true"
    >
      <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-3.5 w-64 animate-pulse rounded bg-muted/70" />
      <div className="mt-3 h-40 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
