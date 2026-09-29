"use client";

import { useEffect, useState } from "react";

import { readPreview } from "@/lib/auth-preview";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * The corner label on a local preview, so nobody mistakes it for the real
 * screen. Leads back to the gallery. Renders nothing in production.
 */
export function PreviewPill({ state }: { state: string | null }) {
  if (!AUTH_PREVIEW || !state) return null;
  return (
    <a
      href="/dev/auth-screens#gallery"
      target="_top"
      data-auth-preview-pill=""
      title="Local preview. Nothing here reaches the server. Back to the gallery"
      style={{
        position: "fixed", right: 10, bottom: 10, zIndex: 2147483647,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: 999,
        background: "#9b1d50", color: "#fff",
        font: "700 11px/1.2 ui-sans-serif, system-ui, sans-serif", letterSpacing: ".06em",
        textDecoration: "none", boxShadow: "0 4px 14px rgba(70, 24, 47, .28)",
      }}
    >
      PREVIEW · {state}
    </a>
  );
}

/** The same label for a screen with many early returns: it reads `?preview=` itself. */
export function PreviewPillFromUrl({ allowed }: { allowed: readonly string[] }) {
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    if (!AUTH_PREVIEW) return;
    const t = window.setTimeout(() => setState(readPreview(allowed)));
    return () => window.clearTimeout(t);
  }, [allowed]);
  return <PreviewPill state={state} />;
}
