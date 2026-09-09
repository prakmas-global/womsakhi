"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { SHOWABLE, shownCount } from "@/components/ux/eight/data";

/**
 * What someone else sees when you hand them your phone.
 *
 * ── Disclosure, not hiding ──────────────────────────────────────────────────
 * Handsets are shared. Every other product treats that as a hiding problem —
 * a panic button, a decoy app — which is furtive and casts her as the one doing
 * something wrong. This is the same mechanism told the other way round: a view
 * she can *offer.* "Here, look" is a sentence she can say out loud in front of
 * a husband or a mother-in-law; opening a hidden vault is not.
 *
 * ── The preview is the whole design ─────────────────────────────────────────
 * A settings list of toggles cannot answer the only question she has, which is
 * *what will he actually see.* So the phone is drawn at full size beside the
 * switches, and every toggle changes it live. Some rows are locked shut and say
 * so plainly — a switch that could expose her savings should not exist, and its
 * absence is more reassuring than its "off" position would be.
 */
export default function ShowingPage() {
  const router = useRouter();
  const [rows, setRows] = useState(SHOWABLE);
  const [handed, setHanded] = useState(false);

  const on = useMemo(() => rows.filter((r) => r.on), [rows]);
  const count = useMemo(() => shownCount(rows), [rows]);

  const toggle = useCallback((id: string) => {
    setRows((r) => r.map((x) => (x.id === id && !x.locked ? { ...x, on: !x.on } : x)));
  }, []);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-5">
        <Back to="/app/vault" label="Back to your locker" />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Showing someone
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            &ldquo;Here, look&rdquo;
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Sometimes someone at home wants to see what you are doing on your phone. This is a screen
            you can hand over. You choose what is on it, and what is on it is true — you are not
            hiding, you are showing.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Left: the switches */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionHead title="What they can see"
                           sub={`${count} of ${rows.length} things are on`} icon="Eye" />
              <Card pad={0} style={{ overflow: "hidden" }}>
                {rows.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3.5 px-5 py-4"
                       style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                          style={{
                            background: v(r.locked ? "--ux-surface-2" : r.on ? "--ux-tint-green" : "--ux-surface-2"),
                            color: v(r.locked ? "--ux-muted" : r.on ? "--ux-green-ink" : "--ux-muted"),
                          }}>
                      <I name={r.icon} className="h-[17px] w-[17px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{r.label}</p>
                        {r.locked && <Pill tone="neutral" size="sm">Never</Pill>}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{r.detail}</p>
                    </div>

                    {r.locked ? (
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                            style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}
                            title="This can never be shown">
                        <I name="Lock" className="h-[13px] w-[13px]" />
                      </span>
                    ) : (
                      <button type="button" role="switch" aria-checked={r.on}
                              aria-label={`Show ${r.label}`}
                              onClick={() => toggle(r.id)}
                              className="ux-press ux-sq relative h-[26px] w-[46px] shrink-0 rounded-full"
                              style={{ background: v(r.on ? "--ux-green-ink" : "--ux-line-strong"),
                                       transition: "background var(--ux-t-fast) var(--ux-ease)" }}>
                        <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full"
                              style={{ left: r.on ? 23 : 3, background: v("--ux-surface"),
                                       transition: "left var(--ux-t-fast) var(--ux-ease)" }} />
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            </div>

            <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
              <div className="flex items-start gap-3">
                <I name="ShieldCheck" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  Your locker, your pockets, your savings pot and your papers have no switch at all —
                  not one that is turned off, one that does not exist. Nobody can turn them on: not
                  someone holding your phone, not someone who knows your PIN, not us. Everything else
                  is your choice, and you can change it any time.
                </p>
              </div>
            </Card>
          </div>

          {/* Right: the actual phone, sticky so it stays visible while she flips switches */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2.5 text-center text-2xs font-extrabold uppercase tracking-[0.14em]"
               style={{ color: v("--ux-muted") }}>
              What they will see
            </p>

            <div className="mx-auto w-[280px] rounded-[24px] p-[8px]"
                 style={{ background: v("--ux-ink"), boxShadow: v("--ux-shadow-pop") }}>
              <div className="relative overflow-hidden rounded-[24px]" style={{ background: v("--ux-surface") }}>
                {/* notch */}
                <div className="absolute left-1/2 top-2 h-[5px] w-[64px] -translate-x-1/2 rounded-full"
                     style={{ background: v("--ux-ink"), opacity: 0.3 }} />

                <div className="px-4 pb-5 pt-8">
                  <p className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Priya Sharma</p>
                  <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>Tailoring and mehendi</p>

                  <div className="mt-4 flex flex-col gap-2">
                    {on.length === 0 && (
                      <p className="rounded-[12px] px-3 py-6 text-center text-xs"
                         style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                        Nothing at all. They will see an empty screen.
                      </p>
                    )}

                    {on.map((r) => (
                      <div key={r.id} className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5"
                           style={{ background: v("--ux-surface-2") }}>
                        <I name={r.icon} className="h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-brand") }} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight" style={{ color: v("--ux-ink") }}>
                            {PREVIEW[r.id]?.head ?? r.label}
                          </p>
                          <p className="text-2xs leading-tight" style={{ color: v("--ux-muted") }}>
                            {PREVIEW[r.id]?.sub ?? r.detail}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* What is NOT there is the point, so it is said out loud */}
                    <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-2xs"
                       style={{ color: v("--ux-muted") }}>
                      <I name="Lock" className="h-[10px] w-[10px]" />
                      No money, no savings, no papers
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2">
              <Btn full icon="Smartphone" onClick={() => setHanded(true)}>
                {handed ? "Showing — tap your PIN to come back" : "Show this now"}
              </Btn>
              {handed && (
                <p className="text-center text-xs" style={{ color: v("--ux-muted") }}>
                  Your phone stays on this screen until you type your PIN. Nothing else opens.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

/** What each switched-on row actually renders as on the handed-over phone. */
const PREVIEW: Record<string, { head: string; sub: string }> = {
  sh1: { head: "87 orders finished", sub: "Last one on Tuesday" },
  sh2: { head: "Priya's Tailoring", sub: "9 things for sale" },
  sh3: { head: "Stitching class", sub: "Thursdays, 4pm, community hall" },
  sh4: { head: "Earned this month", sub: "₹9,400" },
};
