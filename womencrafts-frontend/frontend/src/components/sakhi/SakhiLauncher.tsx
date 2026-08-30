"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import SakhiStage from "./SakhiStage";

/**
 * The button that brings Sakhi up, and the panel she appears in.
 *
 * Her own face is the button — not a chat bubble or a robot glyph. A woman who
 * would rather speak than navigate should recognise who she is about to talk to
 * before she taps.
 *
 * Mounted once in the member shell so she is reachable from every screen. She
 * is not rendered until the first tap: her artwork is ~1.7MB and there is no
 * reason to spend that on someone who never asks for her.
 */
export default function SakhiLauncher() {
  const [open, setOpen] = useState(false);
  // Her language has to travel with her. Without this the stage fell back to
  // its own default and every woman got an English voice, whatever she had
  // chosen — she would read a Telugu reply while hearing it in English.
  const { locale } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Sits above the bottom tab bar on a phone, clear of the safe area. */}
      {/* Bottom-right is crowded: the phone tab bar sits there, and in
          development so does Next's own dev-tools badge, which is drawn on top
          and swallows the tap. She sits above both. */}
      <div className="fixed bottom-24 end-4 z-40 md:bottom-20 md:end-6">
        {open ? null : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ask Sakhi"
            className="group relative grid h-16 w-16 place-items-center rounded-full bg-surface shadow-lg shadow-[color:var(--wc-shadow-overlay)] ring-2 ring-brand-200 transition hover:scale-105 active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sakhi.png"
              alt=""
              draggable={false}
              className="h-14 w-14 rounded-full object-cover"
              style={{ objectPosition: "50% 22%" }}
            />
            <span className="absolute -top-0.5 -end-0.5 h-3.5 w-3.5 rounded-full bg-status-ok-solid ring-2 ring-[color:var(--surface)]" />
          </button>
        )}
      </div>
      {open && <SakhiStage locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}
