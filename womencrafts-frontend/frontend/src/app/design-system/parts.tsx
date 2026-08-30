"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Card, readToken } from "@/design-system";

/* ------------------------------------------------------------------ */
/* Layout helpers for the style guide                                   */
/* ------------------------------------------------------------------ */

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-3xl text-sm text-ink-subtle">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** A single demo: what it looks like, plus the code to reproduce it. */
export function Demo({
  title,
  note,
  code,
  children,
}: {
  title: string;
  note?: string;
  code?: string;
  children: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-ink">{title}</p>
          {note && <p className="mt-0.5 text-xs text-ink-subtle">{note}</p>}
        </div>
        {code && (
          <button
            onClick={() => setShowCode((v) => !v)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-ink transition hover:bg-brand-tint"
          >
            {showCode ? "Hide code" : "Show code"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-6">{children}</div>
      {showCode && code && (
        <pre className="overflow-x-auto border-t border-line bg-surface-inset px-5 py-4 text-xs leading-relaxed text-ink-muted">
          <code>{code}</code>
        </pre>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Live token readouts                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolves a CSS custom property from the live document.
 *
 * The style guide never hardcodes a value — it asks the browser what the token
 * currently resolves to. That means this page cannot drift from tokens.css, and
 * it re-reads on theme change so dark mode shows the dark values.
 */
function useLiveToken(name: string) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const read = () => setValue(readToken(name));
    read();
    // Re-read whenever the theme class flips on <html>.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [name]);

  return value;
}

export function ColorSwatch({ name, usage }: { name: string; usage: string }) {
  const value = useLiveToken(name);
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-11 w-11 shrink-0 rounded-xl border border-black/5"
        style={{ background: `var(${name})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs font-semibold text-ink">{name}</p>
        <p className="font-mono text-2xs uppercase text-ink-subtle">{value || "—"}</p>
        <p className="truncate text-2xs text-ink-subtle" title={usage}>
          {usage}
        </p>
      </div>
    </div>
  );
}

export function ShadowSwatch({ name, usage }: { name: string; usage: string }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className="h-14 w-20 shrink-0 rounded-xl"
        style={{ background: "var(--surface)", boxShadow: `var(${name})` }}
      />
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold text-ink">{name}</p>
        <p className="text-2xs text-ink-subtle">{usage}</p>
      </div>
    </div>
  );
}

export function RadiusSwatch({ name, usage }: { name: string; usage: string }) {
  const value = useLiveToken(name);
  return (
    <div className="flex items-center gap-4">
      <span
        className="h-14 w-14 shrink-0 border-2 border-brand-300 bg-brand-tint"
        style={{ borderRadius: `var(${name})` }}
      />
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold text-ink">{name}</p>
        <p className="font-mono text-2xs text-ink-subtle">{value || "—"}</p>
        <p className="text-2xs text-ink-subtle">{usage}</p>
      </div>
    </div>
  );
}

export function FontSwatch({ name, usage }: { name: string; usage: string }) {
  return (
    <div>
      <p className="text-2xl text-ink" style={{ fontFamily: `var(${name})` }}>
        Empowering women, building futures
      </p>
      <p className="mt-1 font-mono text-xs font-semibold text-ink">{name}</p>
      <p className="text-2xs text-ink-subtle">{usage}</p>
    </div>
  );
}
