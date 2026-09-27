"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { PHONE_COUNTRIES } from "@/lib/phone";

interface CountryPickerProps {
  value: string;
  onChange: (country: string) => void;
  describedBy?: string;
  invalid?: boolean;
}

function CountryFlag({ code, large = false }: { code: string; large?: boolean }) {
  const lower = code.toLowerCase();
  const size = large ? "h-[22px] w-[30px]" : "h-[20px] w-[27px]";
  if (code === "AC" || code === "TA") {
    return <span className={`${size} shrink-0 rounded-[5px] bg-cover bg-center shadow-sm`} style={{ backgroundImage: `url(/ux/flags/${lower}.svg)` }} aria-hidden />;
  }
  return <span className={`fi fi-${lower} ${size} shrink-0 rounded-[5px] shadow-sm`} aria-hidden />;
}

export function CountryPicker({ value, onChange, describedBy, invalid = false }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = PHONE_COUNTRIES.find((country) => country.code === value);
  const options = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES
      .filter((country) => `${country.name} ${country.code} ${country.dial}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => {
        const score = (country: typeof a) => {
          const name = country.name.toLocaleLowerCase();
          if (name === needle || country.code.toLocaleLowerCase() === needle || country.dial === needle) return 0;
          if (name.startsWith(needle)) return 1;
          return 2;
        };
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => search.current?.focus(), 30);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", escape);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative min-w-0">
      <button
        id="su-country"
        type="button"
        role="combobox"
        className={`auth-field flex min-h-[46px] w-full items-center gap-2.5 rounded-[12px] px-3 text-start text-sm${invalid ? " auth-field-invalid" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
      >
        {selected ? (
          <CountryFlag code={selected.code} />
        ) : (
          <span className="grid h-[20px] w-[27px] shrink-0 place-items-center rounded-[5px]" style={{ background: "var(--a-tint-violet)", color: "var(--a-lilac)" }} aria-hidden>◎</span>
        )}
        <span className="min-w-0 flex-1 truncate" style={{ color: selected ? "var(--a-ink)" : "var(--a-faint)" }}>
          {selected ? selected.name : "Select country"}
        </span>
        {selected && <span className="shrink-0 text-xs" style={{ color: "var(--a-muted)" }}>{selected.dial}</span>}
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--a-muted)" }} aria-hidden />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="auth-scene fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" style={{ background: "transparent" }} role="presentation">
          <button type="button" className="absolute inset-0 bg-transparent" style={{ background: "var(--a-scrim)" }} aria-label="Close country picker" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-[24px] border shadow-2xl sm:max-h-[520px] sm:max-w-[430px] sm:rounded-[18px]" style={{ borderColor: "var(--a-edge)", background: "var(--a-night)" }}>
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:hidden">
              <div>
                <p className="text-base font-semibold" style={{ color: "var(--a-ink)" }}>Choose your country</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--a-muted)" }}>Your dial code and number format update automatically.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "var(--a-tint-violet)", color: "var(--a-ink)" }} aria-label="Close country picker"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-3 sm:p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--a-faint)" }} aria-hidden />
                <input ref={search} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    list.current?.querySelector<HTMLButtonElement>("[role=option]")?.focus();
                  }
                }} className="auth-field min-h-[46px] w-full rounded-xl pe-10 ps-10 text-sm" placeholder="Search country or dial code" aria-label="Search countries" />
                {query && <button type="button" onClick={() => setQuery("")} className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg" aria-label="Clear country search"><X className="h-4 w-4" /></button>}
              </div>
            </div>
            <div ref={list} id={listId} role="listbox" aria-label="Countries" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-2">
              {options.map((country) => {
                const active = country.code === value;
                return (
                  <button key={country.code} type="button" role="option" aria-selected={active} onClick={() => choose(country.code)} onKeyDown={(event) => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    event.preventDefault();
                    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
                    const current = buttons.indexOf(event.currentTarget);
                    buttons[current + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
                  }} className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-start transition-colors hover:bg-[var(--a-tint-violet)] focus-visible:bg-[var(--a-tint-violet)]">
                    <CountryFlag code={country.code} large />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--a-ink)" }}>{country.name}</span>
                    <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--a-muted)" }}>{country.dial}</span>
                    <span className="grid h-5 w-5 shrink-0 place-items-center">{active && <Check className="h-4 w-4" style={{ color: "var(--a-rose)" }} aria-hidden />}</span>
                  </button>
                );
              })}
              {!options.length && <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--a-muted)" }}>No country matches that search.</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
