"use client";

import Link from "next/link";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, Progress, SectionHead,
  SourceNote, copy, printCertificate
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead, Segments } from "@/components/ux/learning/native";
import { useLearning } from "@/components/ux/growth";
import { useMe } from "@/components/ux/me";
import { useCertificates } from "@/components/ux/live";

import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/**
 * Certificates — proof, in a form she can hand to someone else.
 *
 * A certificate is only worth what an employer will accept, so every one shows
 * its verification code and can be downloaded or shared as a link. A number on
 * a screen inside an app she alone can open is not proof of anything.
 */
export default function CertificatesPage() {
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
    thumb: c.thumb,
    category: c.category,
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
                    <Link href={`/app/programs/${c.id}`} className="min-w-0 truncate hover:underline" style={{ color: "var(--ux-ink-2)" }}>{c.title}</Link>
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
        <MediaGrid cols={2}>
          {CERTIFICATES.map((c) => (
            <MediaCard
              key={c.id}
              image={artFor([c.title, c.skill], "course", null, c.id)}
              topLeft={{ text: "Certificate", tone: "brand" }}
              topRight={c.verified ? { text: "Verifiable ✓", tone: "green" } : { text: "Withdrawn", tone: "orange" }}
              overlay={<><Icons.Award className="h-[13px] w-[13px]" /> {tr("certificates.certificateOfCompletion")}</>}
              title={c.title}
              subtitle={c.skill}
              meta={<>
                <Fact icon="Calendar">{c.issued}</Fact>
                {c.hours && <Fact icon="Clock">{c.hours} hours</Fact>}
              </>}
              footer={
                <div className="ux-cert-foot flex gap-2 [&>*]:flex-1">
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
              }
            >
              {/* The code is the whole point: it is what someone else checks. */}
              <button
                onClick={async () => {
                  const said = await copy(c.code);
                  if (said !== "Copied") return;
                  setCopied(c.id);
                  window.setTimeout(() => setCopied(null), 1600);
                }}
                className="ux-press ux-hov ux-sq flex w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-start"
                style={{ background: "var(--ux-surface-2)" }}
              >
                <Icons.Hash className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: "var(--ux-ink-2)" }}>{c.code}</span>
                <span role="status" className="shrink-0 text-2xs font-medium" style={{ color: "var(--ux-brand)" }}>
                  {copied === c.id ? "Copied" : "Copy"}
                </span>
              </button>
            </MediaCard>
          ))}
        </MediaGrid>
      ) : (
        <MediaGrid>
          {IN_PROGRESS.map((c) => (
            <MediaCard
              key={c.id}
              href={`/app/programs/${c.id}`}
              image={artFor([c.title, c.category], "course", c.thumb, c.id)}
              topLeft={{ text: "In progress", tone: "light" }}
              topRight={{ text: `${c.pct}%`, tone: "dark" }}
              title={c.title}
              subtitle={c.left}
              footer={<Btn href={`/app/programs/${c.id}`} variant="primary" size="sm" iconEnd="ArrowRight" full>Continue</Btn>}
            >
              <Progress pct={c.pct} />
            </MediaCard>
          ))}
        </MediaGrid>
      )}
    </HomeShell>
  );
}
