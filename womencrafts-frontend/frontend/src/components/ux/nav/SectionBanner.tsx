"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { I } from "@/components/ux/kit";
import { SECTIONS, trailFor } from "@/components/ux/nav-tree";
import { useNavLabel } from "@/components/ux/use-nav-label";
import { bannerFor, type Banner } from "./banners";

/**
 * The banner at the top of a section's screens (what fills it: ./banners.ts).
 *
 * Drawn by the Shell above the page, so every screen in the tree has one
 * without any page knowing about it — and so the day this slot carries a
 * sponsor, it changes in one place.
 *
 * The brand is the ground — the same plum-to-orchid as Home's hero — so every
 * banner is unmistakably WomSakhi; the photo or the pictogram says which
 * screen; the line is for whoever can read it. Compact on a phone
 * (it sits above the content she came for, not instead of it).
 */
export function SectionBanner() {
  const path = usePathname() ?? "";
  const nav = useNavLabel();
  const b = bannerFor(path);
  if (!b) return null;
  const section = SECTIONS.find((s) => s.id === trailFor(path)[0]?.id);
  return <BannerView b={b} module={section ? nav.label(section) : ""} />;
}


export function BannerView({ b, module }: { b: Banner; module: string }) {
  const photo = b.kind === "image" || b.kind === "ad" ? b.image : "";
  const body = (
    <div data-banner className="ux-section-banner ux-sq ux-grain relative isolate mb-5 flex min-h-[132px] overflow-hidden rounded-[22px] lg:mb-6 lg:min-h-[168px]"
         style={{ background: "var(--ux-banner-ground)", boxShadow: "var(--ux-shadow-card)" }}>
      {/* Soft shapes, so a flat colour reads as a picture. */}
      <span aria-hidden className="absolute -start-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-20 start-1/3 h-48 w-48 rounded-full bg-black/10" />

      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" aria-hidden decoding="async"
             className="absolute inset-y-0 end-0 h-full w-[44%] object-cover sm:w-[42%]"
             style={{ maskImage: "linear-gradient(to right, transparent 0%, #000 34%)",
                      WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 34%)" }} />
      ) : (
        <span aria-hidden className="absolute -end-4 top-1/2 grid -translate-y-1/2 place-items-center opacity-[0.16] lg:end-6">
          <I name={b.icon} sw={1.4} className="h-[150px] w-[150px] text-white lg:h-[190px] lg:w-[190px]" />
        </span>
      )}

      <div className={`relative flex min-w-0 flex-col justify-center gap-2 p-4 sm:p-5 lg:px-7 lg:py-6 ${photo ? "w-[60%] sm:w-[62%]" : "w-full pe-24 lg:pe-56"}`}>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
          <I name={b.icon} sw={2.2} className="h-3.5 w-3.5" />
          {b.kind === "ad" ? `Sponsored · ${b.sponsor}` : module}
        </span>
        {b.kind === "quote" ? (
          <blockquote className="min-w-0">
            <p className="line-clamp-4 text-[17px] font-extrabold leading-snug text-white sm:text-lg lg:text-[22px] lg:leading-tight"
               style={{ textShadow: "0 1px 12px rgba(0,0,0,.18)" }}>
              <span aria-hidden className="me-1 font-serif text-[1.4em] leading-none opacity-70">“</span>
              {b.line}
            </p>
            {b.by && (
              <footer className="mt-1.5 text-xs font-semibold text-white/85">
                — {b.by}{b.who ? <span className="font-normal text-white/70">, {b.who}</span> : null}
              </footer>
            )}
          </blockquote>
        ) : (
          <p className="line-clamp-3 text-[17px] font-extrabold leading-snug text-white sm:text-lg lg:text-[24px] lg:leading-tight"
             style={{ textShadow: "0 1px 12px rgba(0,0,0,.18)" }}>
            {b.line}
          </p>
        )}
        {b.kind === "ad" && (
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold"
                style={{ color: "var(--ux-fill)" }}>
            {b.cta} <I name="ArrowRight" className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
  // A sponsor's banner is a link out; ours are not buttons, so they are not links.
  return b.kind === "ad"
    ? <Link href={b.href} rel="sponsored noopener" className="block">{body}</Link>
    : <section aria-label={module}>{body}</section>;
}
