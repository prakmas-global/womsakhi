"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, DeskTitle } from "@/components/ux/cycle/parts";
import { GUIDES } from "@/components/ux/cycle/data";

/** The guides — open to everyone, tracker or not, any age. */
export default function Guides() {
  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Helpful Resources" />
        <DeskTitle title="Helpful Resources" sub="Short, plain, and drawn from NHS, WHO and ACOG guidance." />
        <ul className="space-y-2.5">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/app/health/cycle/learn/${g.slug}`} className="ux-press flex items-center gap-3.5 rounded-[16px] p-3"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <span className="relative h-[64px] w-[80px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: "var(--cy-hero-b)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.img} alt="" loading="lazy"
                       className={g.art ? "absolute bottom-0 left-1/2 h-[62px] w-auto max-w-none -translate-x-1/2" : "h-full w-full object-cover"} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{g.title}</b>
                  <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{g.sub} · {g.minutes} min read</span>
                </span>
                <Icons.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Column>
    </HomeShell>
  );
}
