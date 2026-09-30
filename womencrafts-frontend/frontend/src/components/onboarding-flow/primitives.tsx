"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Check, Lock, ShieldCheck, Users } from "lucide-react";

import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Art, type ArtName } from "./art";

/**
 * The flow's building blocks, drawn once. Every screen is made of these; no
 * screen styles its own button, tile or tag.
 */

export const SECTIONS = ["You", "Your goals", "Your plan"] as const;
export type SectionIndex = 0 | 1 | 2;

/** A spinner for a busy button or row. Motion is off under reduced motion. */
export function Busy({ label }: { label?: string }) {
  return (
    <span className="wso-busy" role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  );
}

/** Sakhi's face: the approved illustration in a rose-gold halo. */
export function SakhiAvatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`wso-sakhi wso-sakhi-${size}`}>
      <Art name="sakhi" sizes="96px" decorative pos="36% 26%" />
    </span>
  );
}

/**
 * Three named sections instead of "Step 3 of 9": a bar that looks slow at the
 * start makes people quit (see the spec's research). Visual only; the flow
 * announces "Section 2 of 3: Your goals" in its own live region.
 */
export function SectionProgress({ section }: { section: SectionIndex }) {
  return (
    <div className="wso-progress" aria-hidden="true">
      <div className="wso-progress-bars">
        {SECTIONS.map((s, i) => <i key={s} className={i <= section ? "on" : undefined} />)}
      </div>
      <div className="wso-progress-names">
        {SECTIONS.map((s, i) => <span key={s} className={i === section ? "now" : undefined}>{s}</span>)}
      </div>
    </div>
  );
}

/**
 * The speaker button: the app's own ReadAloud (browser speech, works while
 * she waits), reading the element `targetId`. With `autoPlay`, it reads once
 * by itself — only after her first tap anywhere, because browsers block
 * speech before any interaction and a phone that talks unasked in a shared
 * room is its own problem.
 */
export function ListenButton({ targetId, autoPlay, onPlayed }: { targetId: string; autoPlay: boolean; onPlayed?: () => void }) {
  const box = useRef<HTMLSpanElement>(null);
  const played = useRef(onPlayed);
  useEffect(() => { played.current = onPlayed; });
  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => {
      const btn = box.current?.querySelector<HTMLButtonElement>("button");
      if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
      played.current?.();
    }, 450);
    return () => window.clearTimeout(t);
  }, [autoPlay]);
  return (
    <span className="wso-listen" ref={box}>
      <ReadAloud targetId={targetId} label="Listen" lang="en-IN" />
    </span>
  );
}

/** Continue (or Start) and Skip (or Not now), in the thumb zone, equal in reach. */
export function StepFooter({
  primary, secondary, note,
}: {
  primary?: { label: string; onClick?: () => void; disabled?: boolean; busy?: boolean; href?: string };
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  note?: ReactNode;
}) {
  return (
    <footer className="wso-foot">
      {note && <div className="wso-foot-note">{note}</div>}
      <div className="wso-foot-row">
        {secondary && (
          <button type="button" className="wso-btn wso-ghost" onClick={secondary.onClick} disabled={secondary.disabled}>
            {secondary.label}
          </button>
        )}
        {primary && (primary.href ? (
          <Link className="wso-btn wso-go" href={primary.href}>{primary.label}</Link>
        ) : (
          <button type="button" className="wso-btn wso-go" onClick={primary.onClick}
                  disabled={primary.disabled || primary.busy} aria-busy={primary.busy || undefined}>
            {primary.busy && <Busy />}
            {primary.label}
          </button>
        ))}
      </div>
    </footer>
  );
}

/** A choice pill. `pressed` is her answer; the whole pill is the target. */
export function Pill({
  pressed, onClick, children, disabled, dashed, lang,
}: {
  pressed: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; dashed?: boolean; lang?: string;
}) {
  return (
    <button type="button" className={`wso-pill${dashed ? " is-dashed" : ""}`} aria-pressed={dashed ? undefined : pressed}
            onClick={onClick} disabled={disabled} lang={lang}>
      {pressed && !dashed && <Check className="wso-pill-check" aria-hidden strokeWidth={3} />}
      <span>{children}</span>
    </button>
  );
}

/**
 * A picture tile for a multi-select question: the illustration (or an icon)
 * above its label, a berry check badge when chosen. Without art or icon it
 * becomes the dashed text tile ("Just looking around").
 */
export function PictureTile({
  art, icon, label, pressed, onClick, sizes = "(min-width: 640px) 150px, 50vw",
}: {
  art?: ArtName; icon?: ReactNode; label: string; pressed: boolean; onClick: () => void; sizes?: string;
}) {
  const kind = art ? "is-photo" : icon ? "is-icon" : "is-text";
  return (
    <button type="button" className={`wso-tile ${kind}`} aria-pressed={pressed} onClick={onClick}>
      {art && <span className="wso-tile-pic"><Art name={art} sizes={sizes} decorative /></span>}
      {icon && <span className="wso-ic">{icon}</span>}
      <span className="wso-tile-label">{label}</span>
      <span className="wso-tile-badge" aria-hidden="true"><Check strokeWidth={3.2} /></span>
    </button>
  );
}

/** An on/off setting drawn as a card: icon, title, one line of why, a switch. */
export function ToggleRow({
  icon, title, desc, checked, onChange,
}: {
  icon: ReactNode; title: string; desc: string; checked: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="wso-toggle" onClick={() => onChange(!checked)}>
      <span className="wso-ic">{icon}</span>
      <span className="wso-toggle-text"><b>{title}</b><small>{desc}</small></span>
      <span className="wso-switch" aria-hidden="true"><i /></span>
    </button>
  );
}

/** One answer of a single-choice question, drawn as a card. */
export function ChoiceCard({
  checked, onSelect, title, desc, icon,
}: {
  checked: boolean; onSelect: () => void; title: string; desc?: string; icon?: ReactNode;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="wso-choice" onClick={onSelect}>
      {icon && <span className="wso-ic">{icon}</span>}
      <span className="wso-toggle-text"><b>{title}</b>{desc && <small>{desc}</small>}</span>
      <span className="wso-radio" aria-hidden="true" />
    </button>
  );
}

export function Tag({ tone = "plain", children }: { tone?: "plain" | "draft" | "private" | "ok"; children: ReactNode }) {
  return <span className={`wso-tag is-${tone}`}>{children}</span>;
}

/** "Draft · only you can see this" — a thing made for her that nobody else can see. */
export function DraftTag({ short = false }: { short?: boolean }) {
  return <Tag tone="draft"><Lock aria-hidden />{short ? "Draft · only you" : "Draft · only you can see this"}</Tag>;
}

/** "Private" — kept for her alone. */
export function PrivateTag({ children = "Only you can see this" }: { children?: ReactNode }) {
  return <Tag tone="private"><ShieldCheck aria-hidden />{children}</Tag>;
}

/** The small "Helper mode" chip, on every screen while someone is helping her. */
export function HelperChip() {
  return <span className="wso-helper-chip"><Users aria-hidden />Helper mode</span>;
}

/**
 * One prepared thing on "Here's what we prepared": what it is, whether anyone
 * can see it, why it is here, and what she can do with it.
 */
export function ReviewItemCard({
  icon, title, meta, tag, reason, children, done, labelId,
}: {
  icon: ReactNode; title: ReactNode; meta?: ReactNode; tag?: ReactNode; reason?: string;
  children?: ReactNode; done?: ReactNode; labelId: string;
}) {
  return (
    <article className={`wso-item${done ? " is-settled" : ""}`} aria-labelledby={labelId}>
      <div className="wso-item-head">
        <span className="wso-ic">{icon}</span>
        <div className="wso-item-text">
          <h3 id={labelId}>{title}</h3>
          {meta && <div className="wso-item-meta">{meta}</div>}
        </div>
      </div>
      {tag}
      {reason && <p className="wso-why">{reason}</p>}
      {done ? <p className="wso-item-done" role="status">{done}</p> : children && <div className="wso-acts">{children}</div>}
    </article>
  );
}

export type SetupRowState = "waiting" | "working" | "done";

/** The setting-up list: each row ticks when its thing has really been made. */
export function SettingUpList({ rows }: { rows: { key: string; label: string; state: SetupRowState }[] }) {
  return (
    <ul className="wso-setup-list">
      {rows.map((r) => (
        <li key={r.key} className={`is-${r.state}`}>
          <i aria-hidden="true">{r.state === "done" && <Check strokeWidth={3.2} />}</i>
          <span>{r.label}<span className="sr-only">{r.state === "done" ? " — ready" : r.state === "working" ? " — preparing" : ""}</span></span>
        </li>
      ))}
    </ul>
  );
}
