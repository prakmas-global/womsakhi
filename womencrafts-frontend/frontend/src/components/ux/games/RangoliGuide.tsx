"use client";

import { useEffect, useMemo, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Sheet } from "@/components/ux/kit";
import { PAPER } from "./RangoliArt";
import { cmOf, guideFor, type GuideStep, type Pt } from "./rangoli-guide";
import type { Design, Seg } from "./rangoli-designs";
import { loadFills } from "./rangoli-store";

/**
 * Prepare — how to draw this rangoli on the floor, a step at a time.
 *
 * She picks how big (1, 2 or 3 feet across) and every distance is given in
 * centimetres for that size. Each step shows where its dots go: this step's
 * dots numbered in pink, earlier ones in grey, the guide circle dashed, and the
 * pieces the dots are for outlined, so she can see what she is building.
 */

const SIZES = [
  { cm: 30, label: "1 ft", sub: "30 cm" },
  { cm: 60, label: "2 ft", sub: "60 cm" },
  { cm: 90, label: "3 ft", sub: "90 cm" },
];
const SIZE_KEY = "womsakhi.rangoli.size";
const BRAND = "#D6246E", INK = "#4a3340", FAINT = "#ecdde4", GREY = "#b9a6b0";
/** Colours for the last step's picture when she has not coloured it yet. */
const SAMPLE = ["#F6A21E", "#D6246E", "#0E7C86", "#F2CF3A", "#E2453C", "#59A845", "#3D4DB7", "#9B7FD4"];

function Shape({ g, ...rest }: { g: Seg } & React.SVGProps<SVGPathElement & SVGCircleElement>) {
  return g.circle
    ? <circle cx={g.circle.cx} cy={g.circle.cy} r={g.circle.r} transform={g.tf} {...rest} />
    : <path d={g.d} transform={g.tf} {...rest} />;
}

function Plan({ design, steps, at, widthCm, fills }: {
  design: Design; steps: GuideStep[]; at: number; widthCm: number; fills: Record<string, string>;
}) {
  const step = steps[at];
  const cm = cmOf(widthCm);
  const before = steps.slice(0, at);
  const oldDots = before.flatMap((s) => s.dots);
  const oldGuides = before.flatMap((s) => s.guides);
  const mine = new Set(step.rings);
  const colour = step.kind === "colour", join = step.kind === "join";
  const ringColour = useMemo(() => {
    const rings = [...new Set(design.segs.map((g) => g.ring))];
    return Object.fromEntries(rings.map((r, i) => [r, SAMPLE[i % SAMPLE.length]]));
  }, [design]);
  const numbered = step.dots.length > 1 && step.dots.length <= 32;
  const first: Pt | undefined = step.kind === "ring" || step.kind === "outline" ? step.dots[0] : undefined;

  return (
    <svg viewBox="-215 -215 430 430" className="block aspect-square w-full rounded-[16px]" role="img"
         aria-label={`Step ${at + 1} of ${steps.length}: ${step.title}`} data-rangoli-plan>
      <rect x="-215" y="-215" width="430" height="430" fill={PAPER} />
      {/* the whole design, faint: where all this is going */}
      {design.segs.map((g) => (
        <Shape key={g.id} g={g}
               fill={colour ? (fills[g.id] && fills[g.id] !== "#ffffff" ? fills[g.id] : ringColour[g.ring]) : "none"}
               stroke={colour ? "#fff" : join ? INK : mine.has(g.ring) ? BRAND : FAINT}
               strokeWidth={colour ? 1.2 : join ? 1.6 : mine.has(g.ring) ? 2.4 : 1.3}
               fillOpacity={colour ? 1 : 0} />
      ))}
      {!colour && (
        <>
          {/* guide circles: earlier ones light, this step's in pink */}
          {oldGuides.map((r, i) => <circle key={`og${i}`} r={r} fill="none" stroke={GREY} strokeWidth={1} strokeDasharray="3 5" opacity={0.6} />)}
          {step.guides.map((r, i) => <circle key={`g${i}`} r={r} fill="none" stroke={BRAND} strokeWidth={1.6} strokeDasharray="6 6" />)}
          {/* how far: from the middle to the first dot */}
          {first && (
            <g data-rangoli-measure>
              <line x1={0} y1={0} x2={first.x} y2={first.y} stroke={BRAND} strokeWidth={1.4} />
              <rect x={first.x / 2 + 8} y={first.y / 2 - 11} width={58} height={22} rx={11} fill="#fff" stroke={BRAND} strokeWidth={1} />
              <text x={first.x / 2 + 37} y={first.y / 2 + 4.5} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={BRAND}>
                {cm(Math.hypot(first.x, first.y))}
              </text>
            </g>
          )}
          {oldDots.map((p, i) => <circle key={`od${i}`} cx={p.x} cy={p.y} r={4.2} fill={join ? INK : GREY} />)}
          {step.dots.map((p, i) => (
            <g key={`d${i}`}>
              <circle cx={p.x} cy={p.y} r={numbered ? 8.5 : 6} fill={BRAND} stroke="#fff" strokeWidth={2} />
              {numbered && <text x={p.x} y={p.y + 3.4} textAnchor="middle" fontSize={i + 1 >= 10 ? 8 : 9.5} fontWeight={800} fill="#fff">{i + 1}</text>}
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

export function RangoliGuide({ design, open, onClose, colourHref }: {
  design: Design | null; open: boolean; onClose: () => void;
  /** The colouring page, for "Try the colours here". */
  colourHref?: string;
}) {
  const guide = useMemo(() => (design ? guideFor(design) : null), [design]);
  const [at, setAt] = useState(0);
  const [widthCm, setWidthCm] = useState(60);
  const [fills, setFills] = useState<Record<string, string>>({});

  // A new design starts at step one; her size and colouring are read from this phone.
  useEffect(() => {
    if (!open || !design) return;
    const t = setTimeout(() => {
      setAt(0);
      setFills(loadFills(design.id));
      try { const v = Number(localStorage.getItem(SIZE_KEY)); if (SIZES.some((s) => s.cm === v)) setWidthCm(v); } catch { /* fine */ }
    }, 0);
    return () => clearTimeout(t);
  }, [open, design]);
  const pickSize = (v: number) => { setWidthCm(v); try { localStorage.setItem(SIZE_KEY, String(v)); } catch { /* fine */ } };

  if (!design || !guide) return null;
  const steps = guide.steps;
  // Opening another design starts again at step one; until that lands, stay inside this one's steps.
  const i = Math.min(at, steps.length - 1), step = steps[i];
  const cm = cmOf(widthCm);
  const last = i === steps.length - 1;
  const ringCount = new Set(design.segs.map((g) => g.ring)).size;

  return (
    <Sheet open={open} onClose={onClose} icon="Ruler" width={560}
           title={`Prepare ${design.name}`}
           description={`Draw it on your floor: ${guide.totalDots} dots in ${steps.length} steps.`}
           footer={
             <div className="flex w-full items-center gap-2">
               <Btn variant="outline" icon="ChevronLeft" onClick={() => setAt(i - 1)} disabled={i === 0}>Back</Btn>
               <span className="flex-1 text-center text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>Step {i + 1} of {steps.length}</span>
               {last
                 ? (colourHref ? <Btn variant="primary" icon="Palette" href={colourHref}>Try colours</Btn> : <Btn variant="primary" icon="Check" onClick={onClose}>Done</Btn>)
                 : <Btn variant="primary" iconEnd="ChevronRight" onClick={() => setAt(i + 1)}>Next</Btn>}
             </div>
           }>
      <div className="flex flex-col gap-4" data-rangoli-guide={design.id}>
        <div role="radiogroup" aria-label="How big will you draw it?" className="grid grid-cols-3 gap-2">
          {SIZES.map((s) => {
            const on = widthCm === s.cm;
            return (
              <button key={s.cm} type="button" role="radio" aria-checked={on} onClick={() => pickSize(s.cm)}
                      className="ux-press flex min-h-[48px] flex-col items-center justify-center rounded-[12px] border-[1.5px] px-2 py-1.5"
                      style={on ? { borderColor: "var(--ux-brand)", background: "var(--ux-tint-pink)" } : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
                <b className="text-[14px] leading-tight" style={{ color: "var(--ux-ink)" }}>{s.label}</b>
                <span className="text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{s.sub} across</span>
              </button>
            );
          })}
        </div>

        <Plan design={design} steps={steps} at={i} widthCm={widthCm} fills={fills} />

        <div aria-live="polite">
          <p className="text-[11.5px] font-extrabold uppercase tracking-[.06em]" style={{ color: "var(--ux-brand)" }}>
            Step {i + 1}{step.dots.length ? ` · ${step.dots.length} ${step.dots.length === 1 ? "dot" : "dots"}` : ""}
          </p>
          <h3 className="mt-0.5 text-[17px] font-extrabold" style={{ color: "var(--ux-ink)" }}>{step.title}</h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{step.body(cm)}</p>
          {step.tip && (
            <p className="mt-2 flex items-start gap-2 rounded-[12px] p-2.5 text-[12.5px] leading-snug" style={{ background: "var(--ux-tint-pink)", color: "var(--ux-ink-2)" }}>
              <Icons.Sparkles className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} />
              <span>{step.tip}</span>
            </p>
          )}
        </div>

        <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
          {steps.map((s, k) => (
            <li key={k}>
              <button type="button" onClick={() => setAt(k)} aria-current={k === i ? "step" : undefined}
                      aria-label={`Step ${k + 1}: ${s.title}`} title={s.title}
                      className="ux-press grid h-8 min-w-8 place-items-center rounded-full px-2 text-[12px] font-bold tabular-nums"
                      style={k === i ? { background: "var(--ux-brand)", color: "#fff" }
                                      : k < i ? { background: "var(--ux-tint-pink)", color: "var(--ux-brand)" }
                                               : { background: "var(--ux-surface-2, #f4eef1)", color: "var(--ux-muted)" }}>
                {k + 1}
              </button>
            </li>
          ))}
        </ol>

        {i === 0 && (
          <div className="rounded-[14px] border p-3" style={{ borderColor: "var(--ux-line)" }} data-rangoli-need>
            <p className="text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>You will need</p>
            <ul className="mt-1.5 flex flex-col gap-1 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
              <li>• Chalk, or a little white rangoli powder, for the dots</li>
              <li>• A piece of string about {cm(200 + 70)} long, for the circles</li>
              <li>• Rangoli colours: up to {Math.min(ringCount, 8)}, one for each ring</li>
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
