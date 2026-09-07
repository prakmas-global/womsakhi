"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, Pill, SectionHead, SourceNote, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCover } from "@/components/ux/entitlements";
import { useAction } from "@/lib/use-action";
import { apiMarkReference } from "@/lib/entitlements-api";
import { MORE_ART } from "@/components/ux/more/data";

/**
 * Insurance & Pension.
 *
 * Insurance is sold badly to women like these — by agents, on commission, with
 * the cost hidden. So this screen leads with WHAT IT PAYS and WHAT IT COSTS on
 * the same line, in rupees, before anything else. ₹20 a year for ₹2 lakh of
 * cover is a decision anyone can make in five seconds once it is put that way.
 */
export default function CoverPage() {
  const { data: COVER, source, refetch } = useCover();

  /**
   * "I have this" is the whole point of the screen.
   *
   * A woman looking at four government policies needs to know which two she
   * already holds — that is the difference between "go to the bank" and
   * "nothing to do". Nothing recorded it before, so the screen asked her the
   * same question every time she opened it.
   */
  const mark = useAction(
    async (refId: string, state: "active" | "saved") => apiMarkReference(refId, state),
    { onDone: refetch, fallbackError: "We could not save that. Try again in a moment." },
  );
  const [tab, setTab] = useState("What you could have");
  // Named `how` rather than `open` — `open` is window.open in a browser scope.
  const [how, setHow] = useState<string | null>(null);
  const have = COVER.filter((c) => c.have);
  const missing = COVER.filter((c) => !c.have);
  const shown = tab === "What you have" ? have : missing;

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="What you have now" />
            {have.length ? (
              <ul className="ux-stagger space-y-3">
                {have.map((c) => (
                  <li key={c.id} className="ux-hov flex items-start gap-3">
                    <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={36} radius={10} />
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{c.kind}</p>
                      <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                        {c.pays} · renews {c.renews}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>Nothing yet.</p>
            )}
          </Card>

          <Card style={{ borderColor: "var(--ux-orange)" }}>
            <SectionHead title="Nobody should sell you these" icon="ShieldAlert" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every scheme here is bought at a bank counter for the price shown. An agent offering to
              &ldquo;arrange&rdquo; one for a fee is taking money for something free.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/safety" variant="outline" size="sm" full icon="Flag">Report an agent</Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MORE_ART.cover} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[92px] w-[92px] object-contain" />
            <h3 className="relative w-[62%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              ₹20 a year
            </h3>
            <p className="relative mt-2 w-[62%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              That is the whole price of ₹2 lakh of accident cover. Most members do not know it exists.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Insurance &amp; pension</h1>
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {have.length} of {COVER.length} in place. All of these are government schemes bought at a bank counter.
          </p>

      <SourceNote source={source} what="cover" />
        </div>
        <Tabs items={["What you could have", "What you have"]} active={tab} onChange={setTab} />
      </div>

      <div className="ux-deck ux-stagger space-y-[12px]">
        {shown.map((c, i) => (
          <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
            <div className="flex items-start gap-3.5">
              <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={50} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {c.name}
                  </h3>
                  <Pill tone={c.kind === "Pension" ? "brand" : c.kind === "Health" ? "blue" : "green"} size="sm">
                    {c.kind}
                  </Pill>
                  {c.have && <Pill tone="green" size="sm">You have this</Pill>}
                </div>

                {/* Pays and costs, on one line, in rupees. This is the decision. */}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="ux-sq rounded-[12px] p-3" style={{ background: "var(--ux-tint-green)" }}>
                    <p className="text-[0.6875rem] uppercase tracking-[0.06em]" style={{ color: "var(--ux-green-ink)" }}>
                      It pays
                    </p>
                    <p className="mt-1 text-[0.875rem] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                      {c.pays}
                    </p>
                  </div>
                  <div className="ux-sq rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
                    <p className="text-[0.6875rem] uppercase tracking-[0.06em]" style={{ color: "var(--ux-faint)" }}>
                      It costs
                    </p>
                    <p className="mt-1 text-[0.875rem] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                      {c.costs}
                    </p>
                  </div>
                </div>

                <p className="mt-2.5 flex items-start gap-1.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                  <Icons.Users className="mt-[1px] h-[13px] w-[13px] shrink-0" />
                  {c.who}
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
                 style={{ borderColor: "var(--ux-line)" }}>
              <span className="text-[0.75rem]" style={{ color: "var(--ux-faint)" }}>
                {c.have ? `Renews ${c.renews} — nothing to do` : "Ask at any bank where you have an account"}
              </span>
              {c.have
                ? (
                    <span className="flex items-center gap-2">
                      <Btn href="/app/documents/vault" variant="outline" size="sm" icon="FileText">Your policy</Btn>
                      <Btn variant="ghost" size="sm"
                           className={mark.busyWith === c.id ? "pointer-events-none opacity-60" : ""}
                           onClick={() => void mark.run(c.id, "saved")}>
                        Not any more
                      </Btn>
                    </span>
                  )
                : <Btn variant="primary" size="sm" iconEnd={how === c.id ? "ChevronUp" : "ChevronDown"}
                       onClick={() => setHow(how === c.id ? null : c.id)}>
                    {how === c.id ? "Close" : "How to get it"}
                  </Btn>}
            </div>

            {/* Where to go and what to carry. Two sentences is the whole of it —
                these are counter transactions, not applications. */}
            {how === c.id && (
              <div className="ux-slide-up mt-3.5 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                <ol className="space-y-2.5">
                  {[
                    "Go to the bank branch where you already have an account. Any branch of it will do.",
                    `Ask for the ${c.name} form. Every bank has it — say the name slowly, they will know.`,
                    "Take your Aadhaar and your passbook. Nothing else is needed.",
                    `Sign the auto-debit line so the ${c.costs.toLowerCase()} comes out on its own. Otherwise it lapses and you find out only when you claim.`,
                  ].map((t, n) => (
                    <li key={n} className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                      <span className="ux-sq grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[8px] text-[0.6875rem] font-bold"
                            style={{ background: "var(--ux-fill)", color: "#fff" }}>{n + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {/* The one that changes what the screen is for. */}
                  <Btn variant="primary" size="sm" icon="Check"
                       className={mark.busyWith === c.id ? "pointer-events-none opacity-60" : ""}
                       onClick={() => void mark.run(c.id, "active")}>
                    {mark.busyWith === c.id ? "Saving…" : "I already have this"}
                  </Btn>
                  <Btn href="/app/documents/vault" variant="outline" size="sm" icon="FolderOpen">Check my papers</Btn>
                  <Btn href="/app/help" variant="ghost" size="sm" icon="MessageCircle">Ask about this</Btn>
                </div>
              </div>
            )}
            {mark.error && mark.busyWith === null && (
              <p className="ux-slide-up mt-3 text-[0.8125rem]" style={{ color: "var(--ux-orange-ink)" }}>
                {mark.error}
              </p>
            )}
          </Card>
        ))}
      </div>
    </HomeShell>
  );
}
