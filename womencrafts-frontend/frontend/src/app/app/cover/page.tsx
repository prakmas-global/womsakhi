"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, Pill, SectionHead, SourceNote } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Segments } from "@/components/ux/learning/native";
import { useCover } from "@/components/ux/entitlements";
import { useAction } from "@/lib/use-action";
import { apiMarkReference } from "@/lib/entitlements-api";
import { MORE_ART as RAW_MORE_ART } from "@/components/ux/more/data";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Insurance & Pension.
 *
 * Insurance is sold badly to women like these — by agents, on commission, with
 * the cost hidden. So this screen leads with WHAT IT PAYS and WHAT IT COSTS on
 * the same line, in rupees, before anything else. ₹20 a year for ₹2 lakh of
 * cover is a decision anyone can make in five seconds once it is put that way.
 */
export default function CoverPage() {
  const MORE_ART = useTranslated(RAW_MORE_ART);
  const tr = useT();
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
            <SectionHead title={tr("cover.whatYouHaveNow")} />
            {have.length ? (
              <ul className="ux-stagger space-y-3">
                {have.map((c) => (
                  <li key={c.id} className="ux-hov flex items-start gap-3">
                    <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={36} radius={10} />
                    <div className="min-w-0">
                      <p className="text-xsm font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{c.kind}</p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                        {c.pays} · renews {c.renews}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("cover.nothingYet")}</p>
            )}
          </Card>

          <Card style={{ borderColor: "var(--ux-orange)" }}>
            <SectionHead title={tr("cover.nobodyShouldSellYouThese")} icon="ShieldAlert" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every scheme here is bought at a bank counter for the price shown. An agent offering to
              &ldquo;arrange&rdquo; one for a fee is taking money for something free.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/safety" variant="outline" size="sm" full icon="Flag">{tr("cover.reportAnAgent")}</Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={MORE_ART.cover} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[92px] w-[92px] object-contain" />
            <h2 className="relative w-[62%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              ₹20 a year
            </h2>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("cover.thatIsTheWholePriceOf")}</p>
          </div>
        </div>
      }
    >
      <div className="mb-6 lg:mb-[20px] lg:flex lg:items-end lg:justify-between lg:gap-4">
        <div>
          <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("cover.insuranceAmpPension")}</h1>
          <p className="mt-2 text-xsm lg:mt-1.5" style={{ color: "var(--ux-muted)" }}>
            {have.length} of {COVER.length} in place. All of these are government schemes bought at a bank counter.
          </p>

      <SourceNote source={source} what="cover" />
        </div>
        {/* The segmented control on its own line on a phone; `lg:contents`
            hands the old `Tabs` straight back to the row it sat in. */}
        <div className="mt-4 lg:contents">
          <Segments items={["What you could have", "What you have"]} active={tab} onChange={setTab} label={tr("cover.whichCover")} />
        </div>
      </div>

      <div className="ux-deck ux-stagger space-y-[12px]">
        {shown.map((c, i) => (
          <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
            <div className="flex items-start gap-3.5">
              <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={50} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {c.name}
                  </h2>
                  <Pill tone={c.kind === "Pension" ? "brand" : c.kind === "Health" ? "blue" : "green"} size="sm">
                    {c.kind}
                  </Pill>
                  {c.have && <Pill tone="green" size="sm">{tr("cover.youHaveThis")}</Pill>}
                </div>

                {/* Pays and costs, on one line, in rupees. This is the decision. */}
                {/* One column on a phone: side by side, each half was a
                    120px box and "₹1,000–₹5,000 a month" broke over three lines. */}
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-2.5">
                  <div className="ux-sq rounded-[12px] px-4 py-3 lg:p-3" style={{ background: "var(--ux-tint-green)" }}>
                    <p className="text-2xs uppercase tracking-[0.06em]" style={{ color: "var(--ux-green-ink)" }}>{tr("cover.itPays")}</p>
                    <p className="mt-1 text-sm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                      {c.pays}
                    </p>
                  </div>
                  <div className="ux-sq rounded-[12px] px-4 py-3 lg:p-3" style={{ background: "var(--ux-surface-2)" }}>
                    <p className="text-2xs uppercase tracking-[0.06em]" style={{ color: "var(--ux-faint)" }}>{tr("cover.itCosts")}</p>
                    <p className="mt-1 text-sm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                      {c.costs}
                    </p>
                  </div>
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-[13px] lg:mt-2.5 lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                  <Icons.Users className="mt-[1px] h-[13px] w-[13px] shrink-0" />
                  {c.who}
                </p>
              </div>
            </div>

            {/* Note on its own line, action full width under it on a phone. */}
            <div className="mt-4 flex flex-col items-stretch gap-3 border-t pt-4 lg:mt-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:pt-3.5"
                 style={{ borderColor: "var(--ux-line)" }}>
              <span className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
                {c.have ? `Renews ${c.renews} — nothing to do` : "Ask at any bank where you have an account"}
              </span>
              {c.have
                ? (
                    <span className="flex items-center gap-2 [&>*]:flex-1 lg:[&>*]:flex-none">
                      <Btn href="/app/documents/vault" variant="outline" size="sm" icon="FileText">{tr("cover.yourPolicy")}</Btn>
                      <Btn variant="ghost" size="sm"
                           className={mark.busyWith === c.id ? "pointer-events-none opacity-60" : ""}
                           onClick={() => void mark.run(c.id, "saved")}>{tr("cover.notAnyMore")}</Btn>
                    </span>
                  )
                : <Btn variant="primary" size="sm" className="ux-action-primary" iconEnd={how === c.id ? "ChevronUp" : "ChevronDown"}
                       onClick={() => setHow(how === c.id ? null : c.id)}>
                    {how === c.id ? "Close" : "How to get it"}
                  </Btn>}
            </div>

            {/* Where to go and what to carry. Two sentences is the whole of it —
                these are counter transactions, not applications. */}
            {how === c.id && (
              <div className="ux-slide-up mt-4 border-t pt-4 lg:mt-3.5 lg:pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                <ol className="space-y-2.5">
                  {[
                    "Go to the bank branch where you already have an account. Any branch of it will do.",
                    `Ask for the ${c.name} form. Every bank has it — say the name slowly, they will know.`,
                    "Take your Aadhaar and your passbook. Nothing else is needed.",
                    `Sign the auto-debit line so the ${c.costs.toLowerCase()} comes out on its own. Otherwise it lapses and you find out only when you claim.`,
                  ].map((t, n) => (
                    <li key={n} className="flex items-start gap-2.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                      <span className="ux-sq grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[8px] text-2xs font-bold"
                            style={{ background: "var(--ux-fill)", color: "var(--ux-on-brand)" }}>{n + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-col gap-2 lg:mt-3.5 lg:flex-row lg:flex-wrap">
                  {/* The one that changes what the screen is for. */}
                  <Btn variant="primary" size="sm" icon="Check"
                       className={mark.busyWith === c.id ? "pointer-events-none opacity-60" : ""}
                       onClick={() => void mark.run(c.id, "active")}>
                    {mark.busyWith === c.id ? "Saving…" : "I already have this"}
                  </Btn>
                  <Btn href="/app/documents/vault" variant="outline" size="sm" icon="FolderOpen">{tr("cover.checkMyPapers")}</Btn>
                  <Btn href="/app/help" variant="ghost" size="sm" icon="MessageCircle">{tr("cover.askAboutThis")}</Btn>
                </div>
              </div>
            )}
            {mark.error && mark.busyWith === null && (
              <p className="ux-slide-up mt-3 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
                {mark.error}
              </p>
            )}
          </Card>
        ))}
      </div>
    </HomeShell>
  );
}
