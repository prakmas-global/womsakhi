"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { DISPUTES, type Dispute } from "@/components/ux/eight/data";

/**
 * When something goes wrong between two women.
 *
 * ── The shape is two sides and a woman standing between them ────────────────
 * A ticket queue puts the platform in the middle and turns a disagreement
 * between neighbours into a case number. This is the one thing a trust network
 * can do that a marketplace cannot: the neutral party is a woman they both
 * already know. So the screen is literally drawn that way — her side on the
 * left, the other woman's on the right, and the helper in the centre — rather
 * than as a status row with a support link.
 *
 * ── Nobody's shop is downgraded for having a dispute ────────────────────────
 * A system that punishes disputes teaches women not to raise them, and the
 * woman who stops raising them is the one being cheated. Stated on the screen,
 * because a promise the user cannot see is not a promise.
 */
export default function DisputesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Dispute[]>(DISPUTES);
  const [note, setNote] = useState<string | null>(null);

  const live = useMemo(() => rows.filter((d) => d.state !== "settled"), [rows]);
  const done = useMemo(() => rows.filter((d) => d.state === "settled"), [rows]);

  const askHelper = useCallback((id: string) => {
    setRows((r) => r.map((d) => (d.id === id ? { ...d, state: "helper", helper: "Sunita Devi" } : d)));
    setNote("Sunita Devi has been asked. She will hear both of you before she says anything.");
  }, []);

  const settle = useCallback((id: string) => {
    setRows((r) => r.map((d) => (d.id === id
      ? { ...d, state: "settled", outcome: "Agreed between you. Nothing goes on either shop." }
      : d)));
    setNote("Settled. Neither of your shops is marked in any way.");
  }, []);

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Back to="/app/shop" label="Back to your shops" />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            When it goes wrong
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Sorted by someone you both know
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            No complaint form, no company deciding who is right. If the two of you cannot agree, a
            woman you both trust hears it out. Your shop is never marked down for this.
          </p>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Being sorted out now" icon="Handshake" chip={String(live.length)} />
          <div className="flex flex-col gap-4">
            {live.map((d) => (
              <Card key={d.id} pad={0} style={{ overflow: "hidden" }}>
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-snug" style={{ color: v("--ux-ink") }}>
                      {d.about}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>
                      {d.raisedBy === "her" ? `${d.with} raised this` : "You raised this"} · {d.when}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                      {formatRupees(d.minor)}
                    </p>
                    <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>is what it is about</p>
                  </div>
                </div>

                {/* Two sides, with the helper standing between them. */}
                <div className="px-5 pt-6">
                  <div className="flex items-stretch gap-2">
                    <Side name="You" sub="Your side" tint="--ux-brand-tint" ink="--ux-brand" letter="P" />

                    <div className="flex min-w-[92px] flex-1 flex-col items-center justify-center">
                      {d.state === "helper" && d.helper ? (
                        <>
                          <span className="grid h-[44px] w-[44px] place-items-center rounded-full"
                                style={{ background: v("--ux-tint-violet"), color: v("--ux-violet") }}>
                            <I name="Scale" className="h-[21px] w-[21px]" />
                          </span>
                          <p className="mt-1.5 text-center text-xs font-bold" style={{ color: v("--ux-ink") }}>
                            {d.helper}
                          </p>
                          <p className="text-center text-2xs" style={{ color: v("--ux-muted") }}>
                            listening to you both
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="h-[2px] w-full" style={{ background: v("--ux-line-strong") }} />
                          <p className="mt-2 text-center text-xs font-semibold" style={{ color: v("--ux-muted") }}>
                            just the two of you
                          </p>
                        </>
                      )}
                    </div>

                    <Side name={d.with} sub="Her side" tint="--ux-tint-pink" ink="--ux-pink-ink"
                          letter={d.with.charAt(0)} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t px-5 py-4" style={{ borderColor: v("--ux-line") }}>
                  <Btn size="sm" icon="MessageCircle" href="/app/messages">
                    Talk to {d.with.split(" ")[0]}
                  </Btn>
                  {d.state === "talking" ? (
                    <Btn size="sm" variant="outline" icon="Users" onClick={() => askHelper(d.id)}>
                      Ask someone you both trust
                    </Btn>
                  ) : (
                    <Btn size="sm" variant="outline" icon="Check" onClick={() => settle(d.id)}>
                      We have sorted it
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" icon="Camera"
                     onClick={() => setNote("Photo added. Both of you and the helper can see it.")}>Add a photo of the work</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {done.length > 0 && (
          <div>
            <SectionHead title="Already sorted" sub="Kept only so you can look it up" icon="CheckCheck" />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {done.map((d, i) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3.5 px-5 py-4"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full"
                        style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                    <I name="Check" className="h-[16px] w-[16px]" sw={2.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{d.about}</p>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {d.with} · {d.outcome}
                    </p>
                  </div>
                  <Pill tone="green" size="sm">Settled</Pill>
                </div>
              ))}
            </Card>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="ShieldCheck" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Having a dispute does not lower your shop, hide your listings, or show anywhere a buyer
              can see. If it counted against you, women would stop raising them — and the woman who
              stops raising them is the one being cheated. The helper is never paid and never takes a
              share of the money.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

function Side({ name, sub, tint, ink, letter }: {
  name: string; sub: string; tint: string; ink: string; letter: string;
}) {
  return (
    <div className="flex min-w-[112px] flex-1 flex-col items-center rounded-[12px] px-3 py-4"
         style={{ background: v(tint) }}>
      <span className="grid h-[40px] w-[40px] place-items-center rounded-full text-base font-bold"
            style={{ background: v("--ux-surface"), color: v(ink) }}>
        {letter}
      </span>
      <p className="mt-2 text-center text-xsm font-bold" style={{ color: v("--ux-ink") }}>{name}</p>
      <p className="text-center text-2xs" style={{ color: v("--ux-ink-2") }}>{sub}</p>
    </div>
  );
}
