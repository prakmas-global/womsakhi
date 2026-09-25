"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT, isUsable } from "@/i18n";
import { Check, ChevronDown, Globe2 } from "lucide-react";

import { rememberPreSignInChoice, useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";

/**
 * Choosing a language BEFORE signing in.
 *
 * The sign-in screen carried a pill reading "English" with a chevron on it and
 * no handler at all: it looked like a control, it was a label. That is the
 * worst place in the product for it. Every other language picker in the app
 * lives behind sign-in, so a woman who does not read English had to get
 * through the one screen written entirely in English before she could reach
 * the setting that would have translated it.
 *
 * Three things follow from who is standing here:
 *
 * - **Her language, in her language.** Every row is set in its own script,
 *   with `lang` and `dir` so the browser picks the right font and shapes the
 *   text properly. A woman looking for Telugu is looking for "తెలుగు"; she
 *   cannot be asked to find the English word "Telugu" first.
 * - **No account yet.** The choice is written to the locale cookie by
 *   `setLocale`, which is all that is available before she has an account to
 *   save it to. Once she signs in, the account setting takes over and follows
 *   her to any device.
 * - **It says what is honest about each one.** A language whose catalogue no
 *   native speaker has read yet is marked as new rather than presented as
 *   finished — the same record `LanguageSwitcher` keeps in Settings.
 *
 * It deliberately does not use that Settings component: this sits outside the
 * `.ux` token scope, on the auth screens' own glass palette, and it is a
 * dropdown over a full-bleed photograph rather than a two-column grid on a
 * page of its own.
 */
export default function LanguageMenu() {
  const tr = useT();
  const { locale, spec, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Outside click and Escape both close it. Bound only while it is open, so
  // the sign-in screen carries no listeners in its resting state.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Focus goes back to the pill, not to the top of the document — she
      // pressed Escape to dismiss this, not to leave the screen.
      button.current?.focus();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Opening puts the cursor on the language she is already using, so the list
  // starts where she is rather than at the top of eighteen rows.
  useEffect(() => {
    if (!open) return;
    const current = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (current ?? list.current?.querySelector<HTMLButtonElement>("button"))?.focus();
  }, [open]);

  /** Up and down walk the list; Home and End jump to its ends. */
  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
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

  function choose(code: string) {
    setLocale(code);
    // She has no account to save this to yet. The note is what stops her
    // account's old language overruling this choice the moment she signs in.
    rememberPreSignInChoice(code);
    setOpen(false);
    button.current?.focus();
  }

  return (
    <div className="auth-language-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="auth-language"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // The pill shows her language; the accessible name says what pressing
        // it does, which the word "हिन्दी" on its own does not.
        aria-label={`Language: ${spec.nativeName}. Choose a different one`}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe2 aria-hidden />
        {/* Her own language's name is set in her own language's script, even
            while the rest of this screen is in another one. */}
        <span lang={spec.code} dir={spec.dir}>{spec.nativeName}</span>
        <ChevronDown aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div
          id={listId}
          ref={list}
          role="listbox"
          aria-label={tr("languageMenu.chooseYourLanguage")}
          className="auth-language-menu"
          onKeyDown={onListKey}
        >
          <p className="auth-language-menu-head">{tr("languageMenu.chooseYourLanguage")}</p>
          <div className="auth-language-menu-list">
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
                  disabled={!isUsable(l.code)}
                  className="auth-language-option"
                  onClick={() => choose(l.code)}
                >
                  <span className="auth-language-option-text">
                    <span className="auth-language-native">{l.nativeName}</span>
                    {/* The English name stays in English and stays LTR: it is
                        there for a woman who is helping someone else find
                        their language, and it is not part of the row's own
                        script. */}
                    <span className="auth-language-english" lang="en" dir="ltr">
                      {l.name}
                      {!isUsable(l.code) && " · coming soon"}
                      {isUsable(l.code) && !l.reviewed && " · new translation"}
                    </span>
                  </span>
                  {active && <Check className="auth-language-tick" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
