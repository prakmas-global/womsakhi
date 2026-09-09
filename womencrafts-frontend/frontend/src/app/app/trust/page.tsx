"use client";

import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, IconTile, Pill, SectionHead, v } from "@/components/ux/kit";
import { PROOFS, RECORD_USES } from "@/components/ux/eight/data";

/**
 * Your record — designed as a document, not a dashboard.
 *
 * ── Why it looks like paper ─────────────────────────────────────────────────
 * A score is something done *to* her. A document is something she *holds*. The
 * whole legal and ethical position of this module depends on the second reading
 * being true, so the screen is shaped like a letter with a seal rather than a
 * profile with a number — because a number invites someone to ask what it takes
 * to raise it, and there is no answer to that here by design.
 *
 * ── Three rules, and they are not negotiable ────────────────────────────────
 * **Positive only.** Nothing bad is ever recorded. In Kenya, 2.7 million people
 * were negatively listed by credit bureaus — half the bad loans under US$10 —
 * until the central bank had to stop it. A record that can hurt her is a weapon
 * pointed at the user.
 *
 * **She holds it. There is no lender feed.** Furnishing this to lenders would
 * look like carrying on the business of credit information, which India's CICRA
 * s.3 prohibits without RBI registration at ₹30 crore minimum capital.
 *
 * **It says honestly who will not accept it.** The US took from statute in 2018
 * to *optional* production use in April 2026 to get lenders to accept
 * alternative data. Pretending a bank will take this is the one thing that would
 * make the module dishonest.
 */
export default function TrustPage() {
  const [made, setMade] = useState(false);
  const months = 9;

  const make = useCallback(() => setMade(true), []);

  /**
   * Uses the phone's own share sheet where it exists, and falls back to
   * copying the text. Deliberately no upload: the record is hers, and sending
   * it anywhere on her behalf is the one thing this module must never do.
   */
  const share = useCallback(async () => {
    const text = `Record of standing — Priya Sharma. ${months} months, ${PROOFS.map((p) => `${p.count} ${p.label.toLowerCase()}`).join(", ")}.`;
    try {
      if (navigator.share) await navigator.share({ title: "My record", text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* she closed the sheet */ }
  }, [months]);

  return (
    <HomeShell active="/app/trust">
      <div className="flex flex-col gap-5" id="trust-page">

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Proof you keep your word
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Proof of who you have been
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Nine months of keeping your word, written down. It belongs to you — we never send it
            to anyone, and nothing bad can ever be written on it.
          </p>
          <div className="mt-3"><ReadAloud targetId="trust-page" /></div>
        </header>

        {/* The document itself. Letterhead, seal, ruled entries. */}
        <div className="rounded-[var(--ux-r-card)] p-[2px]"
             style={{ background: `linear-gradient(140deg, ${v("--ux-brand")}, ${v("--ux-violet")}, ${v("--ux-brand-700")})` }}>
          <div className="rounded-[calc(var(--ux-r-card)-2px)] px-6 py-7 sm:px-9 sm:py-9"
               style={{ background: v("--ux-surface") }}>

            {/* letterhead */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5"
                 style={{ borderColor: v("--ux-line-strong") }}>
              <div>
                <p className="text-2xs font-extrabold uppercase tracking-[0.22em]" style={{ color: v("--ux-brand") }}>
                  Record of standing
                </p>
                <p className="mt-2 font-serif text-2xl font-bold leading-none tracking-[-0.02em]"
                   style={{ color: v("--ux-ink") }}>
                  Priya Sharma
                </p>
                <p className="mt-1.5 text-xs" style={{ color: v("--ux-muted") }}>
                  Tailoring and mehendi · Jaipur
                </p>
              </div>
              <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border-2"
                   style={{ borderColor: v("--ux-brand"), color: v("--ux-brand") }}>
                <div className="text-center">
                  <p className="text-lg font-extrabold leading-none tabular-nums">{months}</p>
                  <p className="text-2xs font-bold uppercase tracking-[0.1em]">months</p>
                </div>
              </div>
            </div>

            {/* entries, ruled like a ledger */}
            <ul className="mt-1">
              {PROOFS.map((p) => (
                <li key={p.id} className="flex items-center gap-4 border-b py-4"
                    style={{ borderColor: v("--ux-line") }}>
                  <IconTile icon={p.icon} tint={p.tint} ink={p.ink} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{p.label}</p>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {p.detail} · since {p.since}
                    </p>
                  </div>
                  <p className="shrink-0 font-serif text-2xl font-bold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {p.count}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <p className="max-w-[40ch] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                Every entry above is something that went right. Nothing that went wrong is recorded
                here, and nothing ever will be.
              </p>
              <div className="text-right">
                <p className="text-2xs font-bold uppercase tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
                  Kept by
                </p>
                <p className="mt-1 font-serif text-base font-bold" style={{ color: v("--ux-ink") }}>
                  Priya Sharma
                </p>
                <p className="text-2xs" style={{ color: v("--ux-muted") }}>Not by WomSakhi</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn icon="FileText" onClick={make}>{made ? "Made" : "Make a copy to show someone"}</Btn>
          {made && <><Btn variant="outline" icon="Share2" onClick={share}>Send it</Btn>
                     <Btn variant="ghost" icon="Printer" onClick={() => window.print()}>Print</Btn></>}
        </div>

        {made && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />
              Yours to send. Nothing left this phone on its own.
            </p>
          </Card>
        )}

        {/* The honest part */}
        <div>
          <SectionHead title="Who will actually take this"
                       sub="Told straight, including where it will not help yet" icon="Handshake" />
          <div className="grid gap-3 sm:grid-cols-2">
            {RECORD_USES.map((u) => (
              <Card key={u.id} pad={16} style={u.accepted ? undefined : { borderStyle: "dashed" }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={u.icon}
                            tint={u.accepted ? "--ux-tint-green" : "--ux-surface-2"}
                            ink={u.accepted ? "--ux-green-ink" : "--ux-muted"} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{u.label}</p>
                      {u.accepted
                        ? <Pill tone="green" size="sm">Works</Pill>
                        : <Pill tone="neutral" size="sm">Not yet</Pill>}
                    </div>
                    <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{u.note}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="ShieldCheck" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              We do not send this to banks, and there is no button that would. Nothing here can ever
              count against you — a missed month simply is not written down. If you stop using
              WomSakhi, you keep the copy.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
