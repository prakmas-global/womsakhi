"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Server-state provider for the whole app.
 *
 * Every screen's data now comes from TanStack Query instead of a hand-rolled
 * `useEffect` + axios + `refresh()` loop, which means: one request per key
 * rather than one per component, instant back-navigation from cache, automatic
 * refetch when the tab regains focus, and real `isLoading` / `isError` flags to
 * drive the skeletons and error states.
 *
 * The client is created inside a `useState` initialiser so each browser session
 * gets exactly one — creating it at module scope would share cache across
 * requests during SSR.
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Admin data changes rarely within a single sitting; half a minute
            // of freshness kills the duplicate fetches on every navigation.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
