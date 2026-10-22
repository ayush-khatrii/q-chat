export default function ProfileSkeleton({
  variant,
}: {
  variant: "self" | "user";
}) {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="h-4 w-24 animate-pulse rounded bg-muted/80" />
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 animate-pulse rounded-full bg-muted/80" />
          <div className="flex-1 space-y-2">
            <div
              className={`h-5 animate-pulse rounded bg-muted/80 ${
                variant === "self" ? "w-44" : "w-40"
              }`}
            />
            <div
              className={`h-3.5 animate-pulse rounded bg-muted/70 ${
                variant === "self" ? "w-60" : "w-56"
              }`}
            />
          </div>
        </div>
      </div>
      {variant === "self" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl border bg-card" />
          <div className="h-24 animate-pulse rounded-2xl border bg-card" />
          <div className="h-24 animate-pulse rounded-2xl border bg-card" />
        </div>
      )}
      <div className="mt-6 space-y-3">
        <div className="h-20 animate-pulse rounded-2xl border bg-card" />
        <div className="h-20 animate-pulse rounded-2xl border bg-card" />
      </div>
    </div>
  );
}
