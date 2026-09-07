import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, GraduationCap, PiggyBank, ShieldCheck } from "lucide-react";

import { DocHeader } from "../_DocHeader";

export const metadata: Metadata = {
  title: "About — WomSakhi",
  description: "What WomSakhi is, who it is for, and how it pays for itself.",
};

const WHAT = [
  {
    icon: BadgeIndianRupee,
    title: "Work you can take today",
    body: "Openings near you, and a shop of your own if you make things. Free to find, free to apply.",
  },
  {
    icon: GraduationCap,
    title: "A skill that pays",
    body: "Short courses that end in a certificate you can show an employer.",
  },
  {
    icon: PiggyBank,
    title: "Saving with women you trust",
    body: "Run a savings circle here. Every rupee goes into the pot, and the record is kept for you.",
  },
  {
    icon: ShieldCheck,
    title: "Help if you ever need it",
    body: "Helplines that work, trusted contacts you choose in advance, and a safety team that reads every report.",
  },
] as const;

/**
 * Who we are.
 *
 * No invented milestones, no "founded in a garage" story, and no member counts
 * — every figure would have to be made up today. What it says instead is what
 * the platform does and how it pays for itself, because "how do you make money
 * if it is free?" is the question a woman being careful actually asks.
 */
export default function AboutPage() {
  return (
    <article className="doc">
      <DocHeader
        title="About WomSakhi"
        updated="30 August 2026"
        lede="A place for women to find work, learn a skill, save together and get help — without paying anyone for the privilege."
      />

      <h2>Why it exists</h2>
      <p>
        Plenty of women can work, and want to. What stops them is rarely ability. It is a
        job that never reaches them, a course that costs more than a month&rsquo;s income,
        a middleman who takes a cut for an introduction, or a platform where being a woman
        means being messaged by strangers.
      </p>
      <p>
        WomSakhi removes those four things. It is women only, joining is free, nobody may
        charge you to find work, and every account is checked by a person before it opens.
      </p>

      <h2>What is on it</h2>
      <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
        {WHAT.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-[12px] p-4"
            style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-3 text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              {title}
            </p>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      <h2>Women only, and how that is kept true</h2>
      <p>
        Saying &ldquo;women only&rdquo; is easy. Keeping it true is the work. Every
        application is read by two people, and joining requires one photo ID so we can
        check it is real.
      </p>
      <p>
        We know that is a lot to ask. So the document is encrypted, it is never shown to
        another member, an employer or a buyer, only the review team can open it, and every
        opening is recorded. The <Link href="/privacy">privacy page</Link> sets out exactly
        what happens to it.
      </p>

      <h2>How it pays for itself</h2>
      <p>
        This is a fair question to ask of anything free, and the honest answer matters more
        than a reassuring one.
      </p>
      <ul>
        <li><strong>Not by charging women to find work.</strong> That is the one line we will not cross.</li>
        <li><strong>Not by advertising</strong>, and not by selling your data. There is no advertiser to sell it to.</li>
        <li>
          <strong>A small fee on paid things</strong> — a course somebody chooses to buy, a
          sale in the shop. Always shown before you commit.
        </li>
      </ul>

      <h2>Who runs it</h2>
      <p>
        WomSakhi is built and operated by PRAKMAS GLOBAL. It is a young platform and it is
        still being built — there are things on this list we do better than others, and we
        would rather you heard that from us.
      </p>
      <p>
        If something is broken, unclear or wrong, tell us. A woman who reports a problem is
        doing us a favour, and we treat it that way.
      </p>

      <p className="mt-8">
        <Link href="/contact" className="inline-flex items-center gap-1.5 font-semibold">
          Get in touch
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </p>
    </article>
  );
}
