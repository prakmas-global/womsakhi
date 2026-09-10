import { Skeleton, SkeletonCard, SkeletonTable, SkeletonText } from "@/design-system";

/**
 * The loading state shared by every route outside the member app.
 *
 * A skeleton shaped like the content it stands in for, not a spinner: the
 * page keeps its height, so nothing jumps when the data lands and the eye
 * does not have to find its place again.
 *
 * `shape` is chosen per route from what that page actually renders — a table
 * screen gets rows, a settings screen gets stacked panels — because a
 * skeleton of the wrong shape causes the exact layout shift it exists to
 * prevent.
 */
export default function RouteLoading({
  shape = "table",
  title = true,
}: {
  shape?: "table" | "cards" | "form" | "text";
  title?: boolean;
}) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3.5 w-80" />
        </div>
      )}

      {shape === "table" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="wc-card p-5"><SkeletonTable rows={6} cols={5} /></div>
        </>
      )}

      {shape === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {shape === "form" && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="wc-card space-y-3 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {shape === "text" && (
        <div className="wc-card p-6"><SkeletonText lines={8} /></div>
      )}
    </div>
  );
}
