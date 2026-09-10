"use client";

import { AlertTriangle } from "lucide-react";

/**
 * The last boundary. This catches a failure in the root layout itself, so
 * React has already thrown away everything above it — which is why this file
 * has to render its own <html> and <body>.
 *
 * That also means no providers are available here: no theme, no i18n, no
 * fonts. Every colour is written inline and chosen to be legible on either a
 * light or a dark system background, because the class that would have carried
 * the theme is part of what failed.
 *
 * It stays deliberately plain. A screen shown when the app is broken should
 * not itself depend on much.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#faf9fb", color: "#1c1b1f",
                     fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <main role="alert"
              style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                       alignItems: "center", justifyContent: "center",
                       padding: "24px", textAlign: "center" }}>
          <span style={{ display: "grid", placeItems: "center", height: 62, width: 62,
                         borderRadius: "50%", background: "#fdeee2" }}>
            <AlertTriangle size={28} strokeWidth={1.8} color="#8a4b12" />
          </span>

          <h1 style={{ margin: "18px 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "8px 0 0", maxWidth: "42ch", fontSize: "0.9375rem",
                      lineHeight: 1.6, color: "#5c5a63" }}>
            The app could not start. Your account and your data are safe — this is a problem on
            our side, not something you did.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 22, padding: "11px 22px", fontSize: "0.9375rem",
                     fontWeight: 600, color: "#fff", background: "#7c3aed",
                     border: "none", borderRadius: 999, cursor: "pointer",
                     minHeight: 44, minWidth: 44 }}
          >
            Try again
          </button>

          <a href="/app" style={{ marginTop: 14, fontSize: "0.8125rem", color: "#5c5a63" }}>
            Or go back to Home
          </a>

          {error.digest && (
            <p style={{ marginTop: 20, fontSize: "0.6875rem", color: "#8b8994" }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
