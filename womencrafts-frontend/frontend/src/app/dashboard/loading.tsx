/**
 * Branded content skeleton shown while a dashboard route loads.
 * The shell (sidebar + topbar) stays mounted; only this content area shimmers.
 */
export default function DashboardLoading() {
  return (
    <div>
      {/* header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="wc-skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="wc-skeleton h-6 w-52" />
          <div className="wc-skeleton h-3 w-72" />
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="wc-card p-5">
            <div className="flex items-center gap-4">
              <div className="wc-skeleton h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="wc-skeleton h-3 w-20" />
                <div className="wc-skeleton h-6 w-24" />
              </div>
            </div>
            <div className="wc-skeleton mt-4 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* content + rail */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="wc-card space-y-5 p-5">
          <div className="flex items-center justify-between">
            <div className="wc-skeleton h-5 w-44" />
            <div className="wc-skeleton h-8 w-28 rounded-lg" />
          </div>
          <div className="wc-skeleton h-64 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="wc-skeleton h-16 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="wc-card space-y-5 p-5">
          <div className="wc-skeleton h-5 w-32" />
          <div className="wc-skeleton mx-auto h-40 w-40 rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="wc-skeleton h-3 w-28" />
                <div className="wc-skeleton h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
