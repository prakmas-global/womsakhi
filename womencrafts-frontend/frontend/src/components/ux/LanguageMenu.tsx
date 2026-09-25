"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT, isUsable } from "@/i18n";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";
import { apiUpdateMeProfile } from "@/lib/member-api";
import { useAuth } from "@/context/AuthContext";

/**
 * Language, from the bar at the top of every screen.
 *
 * It already existed as a screen — Settings ▸ Language — and that is three
 * taps from wherever she is standing. A woman who has just realised she is
 * reading the wrong language is the least able person in the product to
 * navigate three screens of it to fix that. So the choice is in the bar, in
 * the same row as the theme toggle, on every screen.
 *
 * The full screen stays: it is where the choice is explained, where Sakhi's
 * language is mentioned, and where a save failure is reported properly. This
 * is the shortcut, and it links there at the bottom.
 *
 * What it does with the choice:
 *
 *  1. `setLocale` changes the language in this browser immediately and writes
 *     the cookie, so the very next server render is already correct.
 *  2. `apiUpdateMeProfile` puts it on her ACCOUNT, which is what carries it to
 *     the next device — the phone she borrows, the computer at the centre.
 *
 * Step 2 is allowed to fail quietly here. The screen has already changed by
 * then, so the only thing lost is the remembering, and the Settings screen
 * says so in full when it is the one saving.
 */
export function TopLanguageBtn() {
  const tr = useT();
  const { locale, spec, setLocale } = useI18n();
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Opens on the language she is using, not at the top of eighteen rows.
  useEffect(() => {
    if (!open) return;
    const current = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    current?.scrollIntoView({ block: "center" });
    current?.focus();
  }, [open]);

  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const rows = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? rows.length - 1
      : e.key === "ArrowDown" ? (at + 1) % rows.length
      : (at - 1 + rows.length) % rows.length;
    rows[next]?.focus();
  }

  async function choose(code: string) {
    setLocale(code);
    setSaving(code);
    try {
      await apiUpdateMeProfile({ locale: code });
      // The session's copy of her account has to agree, or every consumer of
      // it still believes the old language until the next page load.
      if (user) updateUser({ ...user, locale: code });
    } catch {
      // Deliberately silent — see the note above the component.
    } finally {
      setSaving("");
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // The glyph is a globe in every language; the accessible name has to
        // carry which language it is currently set to.
        aria-label={`Language: ${spec.nativeName}. Choose a different one`}
        className="ux-press ux-sq grid h-[44px] w-[44px] place-items-center rounded-[12px] transition-colors hover:bg-[var(--ux-surface-2)] lg:h-[42px] lg:w-[42px]"
        style={{ color: "var(--ux-ink-2)" }}
      >
        <Icons.Globe className="h-[21px] w-[21px]" strokeWidth={1.9} />
      </button>

      {open && (
        <div
          id={listId}
          ref={list}
          role="listbox"
          aria-label={tr("languageMenu.chooseYourLanguage")}
          onKeyDown={onListKey}
          className="ux-sheet ux-slide-up absolute end-0 top-[calc(100%+8px)] w-[252px] overflow-hidden rounded-[16px] p-1.5"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-[0.07em]"
             style={{ color: "var(--ux-faint)" }}>
            Language
          </p>
          {/* Capped and scrolled inside its own box. Eighteen rows is taller
              than a phone in portrait, and a menu clipped by the screen edge
              loses its last languages with nothing to say so. */}
          <div className="max-h-[min(52vh,338px)] overflow-y-auto overscroll-contain">
            {LOCALES.map((l) => {
              const active = l.code === locale;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  lang={l.code}
                  dir={l.dir}
                  disabled={!isUsable(l.code) || Boolean(saving)}
                  onClick={() => void choose(l.code)}
                  className="ux-hov flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-start transition-colors hover:bg-[var(--ux-surface-2)] disabled:opacity-50"
                  style={{ background: active ? "var(--ux-brand-tint)" : undefined }}
                >
                  <span className="min-w-0 flex-1">
                    {/* Her script, at a size its marks survive. */}
                    <span className="block truncate text-[15px] font-semibold leading-snug"
                          style={{ color: active ? "var(--ux-brand)" : "var(--ux-ink)" }}>
                      {l.nativeName}
                    </span>
                    <span className="block truncate text-2xs leading-tight" lang="en" dir="ltr"
                          style={{ color: "var(--ux-muted)" }}>
                      {l.name}
                      {!isUsable(l.code) && " · coming soon"}
                      {isUsable(l.code) && !l.reviewed && " · new translation"}
                    </span>
                  </span>
                  {saving === l.code ? (
                    <Icons.Loader className="h-[16px] w-[16px] shrink-0 animate-spin" style={{ color: "var(--ux-brand)" }} />
                  ) : active ? (
                    <Icons.Check className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.6} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="my-1 h-px" style={{ background: "var(--ux-line)" }} />
          <Link
            href="/app/settings/language"
            onClick={() => setOpen(false)}
            className="ux-hov flex min-h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-xsm transition-colors hover:bg-[var(--ux-surface-2)]"
            style={{ color: "var(--ux-ink-2)" }}
          >
            <Icons.Settings className="h-[16px] w-[16px] shrink-0" />
            {tr("languageMenu.languageSettings")}
          </Link>
        </div>
      )}
    </div>
  );
}
