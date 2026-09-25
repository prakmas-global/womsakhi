"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, Progress, SectionHead,
  SourceNote, copy, printCertificate
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead, Segments, Tag } from "@/components/ux/learning/native";
import { useLearning } from "@/components/ux/growth";
import { useMe } from "@/components/ux/me";
import { useCertificates } from "@/components/ux/live";

import { ACCOUNT_ART as RAW_ACCOUNT_ART } from "@/components/ux/account/data";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Certificates — proof, in a form she can hand to someone else.
 *
 * A certificate is only worth what an employer will accept, so every one shows
 * its verification code and can be downloaded or shared as a link. A number on
 * a screen inside an app she alone can open is not proof of anything.
 */
export default function CertificatesPage() {
  const ACCOUNT_ART = useTranslated(RAW_ACCOUNT_ART);
  const tr = useT();
  const ME = useMe();
  const { data: CERTIFICATES, source } = useCertificates();
  const { data: learning } = useLearning();
  // What she is part-way through, from her own enrolments. `left` says how far
  // there is to go as a percentage rather than "4 lessons left" — the server
  // tracks progress, not a lesson count, and inventing the count would tell her
  // there are four when nobody knows.
  const IN_PROGRESS = learning.continuing.map((c) => ({
    id: c.id,
    title: c.title,
    pct: c.pct ?? 0,
    left: `${Math.max(0, 100 - (c.pct ?? 0))}% to go`,
  }));
  const [tab, setTab] = useState("Earned");
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <HomeShell
      active="/app/certificates"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("certificates.stillGoing")} sub={tr("certificates.finishTheseAndTheyJoinThe")} />
            <ul className="ux-stagger space-y-3.5">
              {IN_PROGRESS.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-3 text-xsm">
                    <span className="min-w-0 truncate" style={{ color: "var(--ux-ink-2)" }}>{c.title}</span>
                    <span className="shrink-0 font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>{c.pct}%</span>
                  </div>
                  <div className="mt-1.5"><Progress pct={c.pct} track="--ux-track" h={5} /></div>
                  <p className="mt-1 text-2xs" style={{ color: "var(--ux-faint)" }}>{c.left}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn href="/app/programs" variant="soft" size="sm" full iconEnd="ArrowRight">{tr("certificates.keepGoing")}</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("certificates.whereTheseCount")} icon="BadgeCheck" />
            <ul className="space-y-2.5">
              {[
                "Employers hiring through WomSakhi see them on your profile.",
                "Anyone can check a code at womsakhi.com/verify.",
                "Some schemes accept them as proof of training.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <ScreenHead
        title="Certificates"
        sub={`${CERTIFICATES.length} earned · ${CERTIFICATES.reduce((a, c) => a + c.hours, 0)} hours of learning behind them`}
      >
        <Segments items={["Earned", "In progress"]} active={tab} onChange={setTab} label={tr("certificates.whichCertificates")} />
      </ScreenHead>

      <SourceNote source={source} what="certificates" />

      {tab === "Earned" ? (
        <div className="ux-deck grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {CERTIFICATES.map((c, i) => (
            <Card key={c.id} className="ux-i ux-onscroll flex h-full flex-col overflow-hidden" style={{ ["--i" as string]: i }} pad={0}>
              {/* The metal band is the one place in the app that treatment is
                  used — cold and hard is the right feeling for something
                  awarded, and nowhere else earns it. */}
              <div className="ux-metal flex items-center gap-3 px-4 py-3 lg:px-[20px] lg:py-3.5">
                <Icons.Award className="ux-ico h-[22px] w-[22px] shrink-0" strokeWidth={1.9} />
                <span className="text-xs font-semibold uppercase tracking-[0.1em]">{tr("certificates.certificateOfCompletion")}</span>
              </div>
              <div className="flex flex-1 flex-col p-4 lg:p-5">
                <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                  <span className="inline-flex items-center gap-1"><Icons.Calendar className="h-[14px] w-[14px] shrink-0" /> {c.issued}</span>
                  <span className="inline-flex items-center gap-1"><Icons.Clock className="h-[14px] w-[14px] shrink-0" /> {c.hours} hours</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tag tone="brand" size="sm">{c.skill}</Tag>
                  {c.verified && (
                    <span className="inline-flex items-center gap-1 text-2xs font-medium" style={{ color: "var(--ux-green-ink)" }}>
                      <Icons.BadgeCheck className="h-[14px] w-[14px]" /> Verifiable
                    </span>
                  )}
                </div>

                {/* The code is the whole point: it is what someone else checks. */}
                <button
                  // Same defect as the booking code: it announced a copy it
                  // never made. This is the number an employer checks.
                  onClick={async () => {
                    const said = await copy(c.code);
                    if (said !== "Copied") return;
                    setCopied(c.id);
                    window.setTimeout(() => setCopied(null), 1600);
                  }}
                  className="ux-press ux-hov ux-sq mt-4 flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-start lg:gap-2.5 lg:px-3.5"
                  style={{ background: "var(--ux-surface-2)" }}
                >
                  <Icons.Hash className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: "var(--ux-ink-2)" }}>
                    {c.code}
                  </span>
                  <span role="status" className="shrink-0 text-2xs font-medium" style={{ color: "var(--ux-brand)" }}>
                    {copied === c.id ? "Copied" : "Copy"}
                  </span>
                </button>

                <div className="ux-cert-foot mt-auto flex gap-2 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
                  <ActionBtn variant="primary" size="sm" icon="Download" doneIcon="Printer"
                             done={COPY.saveAsPdf} act={() => printCertificate({
                               name: ME.name, programme: c.title, issued: c.issued,
                               code: c.code, hours: c.hours, grade: c.grade,
                               revoked: !c.verified,
                             })}>
                    Download
                  </ActionBtn>
                  <ActionBtn variant="outline" size="sm" icon="Share2" doneIcon="Copy" done={tr("certificates.linkCopied")}
                             act={() => copy(`https://womsakhi.com/verify/${c.code}`, "Link copied — anyone can check it", "Copy the code instead")}>{tr("certificates.shareLink")}</ActionBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {IN_PROGRESS.map((c, i) => (
            <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              {/* "Continue" takes its own full-width line on a phone rather
                  than a 110px pill squeezing the title beside it. */}
              <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap">
                <span className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[12px]"
                      style={{ background: "var(--ux-tint-violet)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={ACCOUNT_ART.certificate} alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
                  <div className="mt-2 flex items-center gap-2.5">
                    <Progress pct={c.pct} />
                    <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>
                      {c.pct}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: "var(--ux-faint)" }}>{c.left}</p>
                </div>
                <Btn href="/app/programs" variant="primary" size="sm" iconEnd="ArrowRight" className="w-full lg:w-auto">Continue</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}
