"use client";

import { lazy, Suspense, useEffect, useState } from "react";

import { useI18n } from "@/i18n";

// Speech, recording and conversation code is only needed after a member opens
// Sakhi. Loading it here keeps it out of every member screen's initial JS.
const SakhiStage = lazy(() => import("./SakhiStage"));

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
      {/* The shell reserves a utility strip, so this never covers a record or action. */}
      <div
        data-float="sakhi"
        className="fixed z-40"
      >
        {open ? null : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ask Sakhi"
            className="ux-sakhi-trigger ux-press"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sakhi-avatar.webp"
              width={160} height={160}
              /* 1240x1269 and 1.8MB before, drawn at 46px. Now 160px / 47KB. */
              alt=""
              draggable={false}
              className="rounded-full object-cover"
              style={{ objectPosition: "50% 22%" }}
            />
            <span>Ask Sakhi</span>
          </button>
        )}
      </div>
      {open && (
        <Suspense fallback={null}>
          <SakhiStage locale={locale} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
