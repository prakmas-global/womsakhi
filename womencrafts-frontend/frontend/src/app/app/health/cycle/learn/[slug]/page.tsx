"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, CyButton, DeskTitle, heroBg } from "@/components/ux/cycle/parts";
import { guide } from "@/components/ux/cycle/data";

/** One guide. Sources at the foot, and the urgent line first where there is one. */
export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const g = guide(slug);

  if (!g) {
    return (
      <HomeShell immersive bare>
        <Column>
          <CycleHeader title="Guide" back="/app/health/cycle/learn" />
          <p className="mt-8 text-center text-[15px]" style={{ color: "var(--ux-muted)" }}>That guide is not here any more.</p>
          <div className="mt-4"><CyButton href="/app/health/cycle/learn">See all guides</CyButton></div>
        </Column>
      </HomeShell>
    );
  }

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="" back="/app/health/cycle/learn" />
        <div className="relative mb-5 h-[180px] overflow-hidden rounded-[20px]" style={{ background: heroBg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.img} alt=""
               className={g.art ? "absolute bottom-0 left-1/2 h-[172px] w-auto max-w-none -translate-x-1/2" : "h-full w-full object-cover"} />
        </div>
        <DeskTitle title={g.title} sub={`${g.sub} · ${g.minutes} min read`} />
        <h1 className="ux-display text-[28px] font-bold leading-tight lg:hidden" style={{ color: "var(--ux-ink)" }}>{g.title}</h1>
        <p className="mt-1 text-[13px] lg:hidden" style={{ color: "var(--ux-muted)" }}>{g.sub} · {g.minutes} min read</p>

        {g.urgent && (
          <p role="note" className="mt-5 flex items-start gap-2 rounded-[14px] px-3.5 py-3 text-[15px] leading-snug"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-ink)" }}>
            <Icons.ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--ux-danger-solid)" }} aria-hidden />
            {g.urgent}
          </p>
        )}

        <article className="mt-2">
          {g.sections.map((sec) => (
            <section key={sec.h} className="mt-6">
              <h2 className="text-[20px] font-semibold" style={{ color: "var(--ux-ink)" }}>{sec.h}</h2>
              {sec.p && <p className="mt-2 text-[17px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{sec.p}</p>}
              {sec.list && (
                <ul className="mt-2 space-y-2">
                  {sec.list.map((li) => (
                    <li key={li} className="flex items-start gap-2.5 text-[17px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                      <span className="mt-[11px] h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: "var(--cy-period)" }} />
                      {li}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <div className="mt-8 rounded-[16px] px-4 py-3.5" style={{ background: "var(--ux-surface-2)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>Sources</p>
          <ul className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            {g.sources.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <p className="mt-2 text-[12px]" style={{ color: "var(--ux-muted)" }}>This is general information, not a diagnosis.</p>
        </div>

        <div className="mt-5 space-y-1">
          <CyButton href="/app/health/mentors">Ask a health mentor</CyButton>
          <Link href="/app/health/cycle/learn" className="flex h-11 items-center justify-center text-[15px]" style={{ color: "var(--ux-muted)" }}>
            More guides
          </Link>
        </div>
      </Column>
    </HomeShell>
  );
}
