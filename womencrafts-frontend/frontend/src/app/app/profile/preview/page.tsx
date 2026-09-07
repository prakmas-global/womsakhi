"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useCallback } from "react";

import { apiMeProfile, type MeProfile } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { Btn, Card, IconTile, Pill, Rating, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCertificates, useCircles, useProgress } from "@/components/ux/live";
import { useBusiness } from "@/components/ux/business";
import { useMe } from "@/components/ux/me";


/**
 * What is still missing from her profile — the same five fields the profile
 * screen counts, read from `/me/profile` rather than from `PROFILE_STEPS`, a
 * module constant with `done` hardcoded that told every woman the same three
 * things were finished and the same two were not.
 */
function missingFrom(p: MeProfile | null) {
  return [
    { id: "photo", label: "A photo", have: !!p?.avatar },
    { id: "bio", label: "A line about yourself", have: !!p?.bio },
    { id: "phone", label: "Your phone number", have: !!p?.phone },
    { id: "place", label: "Which city you are in", have: !!p?.location },
    { id: "dob", label: "Your date of birth", have: !!p?.dob },
  ].filter((f) => !f.have);
}

/**
 * Her profile, as an employer sees it.
 *
 * This exists because "who can see this?" is unanswerable from a form. The
 * banner at the top is the whole point: everything below it is exactly what a
 * stranger gets, and anything private is shown as WITHHELD rather than simply
 * left out — an absence proves nothing, a stated absence proves a lot.
 *
 * Which makes every invented figure on it worse than usual: this is the screen
 * that promises to show her exactly what a stranger sees, and it was showing
 * her somebody else's city, somebody else's languages, and four counts nobody
 * had counted.
 */
export default function ProfilePreview() {
  const ME = useMe();
  const { data: profile } = useResource(
    useCallback(() => apiMeProfile(), []),
    null as MeProfile | null,
  );
  const { data: CERTIFICATES } = useCertificates();
  const { data: progress } = useProgress();
  const { data: circles } = useCircles();
  const { data: biz } = useBusiness();
  const SHOP = biz.shop;
  const missing = missingFrom(profile);
  const name = profile?.full_name || ME.name;
  const verified = profile?.verification_status === "active";
  const delivered = biz.orders.filter((o) => o.state === "Done").length;

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="What is never shown" icon="Lock" />
            {/* Stated, not omitted. An absence proves nothing. */}
            <ul className="space-y-2.5">
              {[
                "Your phone number",
                "Your address — only the city",
                "Your date of birth",
                "Your documents",
                "What you earn",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.EyeOff className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3.5 rounded-[12px] p-3 text-[0.75rem] leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              An employer can message you through WomSakhi without ever seeing how to reach you directly.
            </p>
          </Card>

          {missing.length > 0 && (
            <Card>
              <SectionHead title="What would make this stronger" sub={`${missing.length} left`} />
              <ul className="ux-stagger space-y-2.5">
                {missing.map((s, i) => (
                  <li key={s.id} className="ux-hov flex items-center gap-2.5 text-[0.8125rem]"
                      style={{ ["--i" as string]: i, color: "var(--ux-ink-2)" }}>
                    <Icons.Circle className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3.5">
                <Btn href="/app/profile" variant="primary" size="sm" full iconEnd="ArrowRight">Fill these in</Btn>
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/profile"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[0.8125rem] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Your profile
      </Link>

      {/* The banner IS the feature — without it this is just a second profile. */}
      <div className="ux-sq mb-[16px] flex items-center gap-3.5 rounded-[12px] p-4"
           style={{ background: "var(--ux-tint-blue)" }}>
        <Icons.Eye className="h-[20px] w-[20px] shrink-0" style={{ color: "var(--ux-blue-ink)" }} />
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
          <strong style={{ color: "var(--ux-ink)" }}>This is exactly what an employer or buyer sees.</strong>{" "}
          Nothing below is private, and nothing private is below.
        </p>
        <Btn href="/app/profile" variant="outline" size="sm" icon="Pencil">Edit</Btn>
      </div>

      <Card className="mb-[16px]">
        <div className="flex items-start gap-4">
          <span className="h-[86px] w-[86px] shrink-0 overflow-hidden rounded-full"
                style={{ background: "var(--ux-brand-tint)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={profile?.avatar || ME.avatar} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[1.25rem] font-bold" style={{ color: "var(--ux-ink)" }}>
              {name}
              {verified && <Icons.BadgeCheck className="h-[19px] w-[19px]" style={{ color: "var(--ux-blue)" }} />}
            </h1>
            {/* "I sew, and I am learning to sell online." was printed as every
                woman's own line, on the screen that swears it shows her only
                what is really there. */}
            <p className="mt-1 text-[0.875rem]"
               style={{ color: profile?.bio ? "var(--ux-ink-2)" : "var(--ux-faint)" }}>
              {profile?.bio || "No line about yourself yet — an employer sees this space empty."}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
              {profile?.location && (
                <span className="inline-flex items-center gap-1.5"><Icons.MapPin className="h-4 w-4" /> {profile.location}</span>
              )}
              {progress?.member_since && (
                <span className="inline-flex items-center gap-1.5">
                  <Icons.Calendar className="h-4 w-4" /> On WomSakhi since {progress.member_since}
                </span>
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {verified && <Pill tone="green" size="sm">Verified member</Pill>}
              {profile?.segment && <Pill tone="brand" size="sm">{profile.segment}</Pill>}
            </div>
          </div>
        </div>

        {/* What a stranger cannot see, said out loud. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-[0.75rem]"
             style={{ borderColor: "var(--ux-line)" }}>
          {["Phone number", "Address", "Date of birth"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5" style={{ color: "var(--ux-faint)" }}>
              <Icons.EyeOff className="h-[13px] w-[13px]" /> {t} — not shown
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-[16px]">
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="What she has done" />
            <div className="grid grid-cols-2 gap-4">
              {/* Three of these four were constants — 6, 87 and 15 — on the
                  screen whose whole promise is that nothing on it is invented. */}
              {[
                [`${progress?.programs_completed ?? 0}`, "Courses finished", "GraduationCap", "--ux-tint-violet", "--ux-violet"],
                [`${CERTIFICATES.length}`, "Certificates", "Award", "--ux-tint-green", "--ux-green"],
                [`${delivered}`, "Orders delivered", "Package", "--ux-tint-orange", "--ux-orange"],
                [`${circles.mine.length}`, "Circles joined", "UsersRound", "--ux-tint-pink", "--ux-pink"],
              ].map(([v, label, icon, tint, ink]) => (
                <div key={label} className="ux-hov flex items-center gap-3">
                  <IconTile icon={icon} tint={tint} ink={ink} size={40} radius={11} />
                  <div className="min-w-0">
                    <p className="text-[1.125rem] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                    <p className="mt-1 truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHead title="Certificates" sub="Anyone can check these codes" />
            <ul className="ux-deck ux-stagger space-y-2.5">
              {CERTIFICATES.map((c, i) => (
                <li key={c.id} className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] border p-3"
                    style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                  <span className="ux-metal ux-sq grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]">
                    <Icons.Award className="ux-ico h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</p>
                    <p className="mt-0.5 truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                      {c.issued} · {c.code}
                    </p>
                  </div>
                  <Icons.BadgeCheck className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="Her shop" />
            <div className="ux-hov flex items-center gap-3">
              <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[12px]"
                    style={{ background: "var(--ux-tint-orange)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={SHOP.art} alt="" className="ux-art h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{SHOP.name}</p>
                <p className="mt-0.5"><Rating value={SHOP.rating} count={`${SHOP.reviews} reviews`} /></p>
              </div>
            </div>
            <div className="mt-3.5">
              <Btn href="/app/documents" variant="soft" size="sm" full iconEnd="ArrowRight">Visit the shop</Btn>
            </div>
          </Card>

          <Card>
            <SectionHead title="Get in touch" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Messages reach her inside WomSakhi. She decides whether to share anything more.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/messages" variant="primary" size="sm" full icon="MessageCircle">Message her</Btn>
            </div>
          </Card>
        </div>
      </div>
    </HomeShell>
  );
}
