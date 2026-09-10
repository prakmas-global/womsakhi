"use client";

import * as Icons from "@/components/ux/icons";
import { Card, I, IconTile, v } from "@/components/ux/kit";
import { CIRCLE_ART, CIRCLE_TIPS, COVER_ALT, COVER_PRESETS, members, topicOf } from "@/components/ux/circle/data";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function CreateHero() {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(102deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 58%, var(--ux-tint-pink) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="relative z-[1] max-w-[520px] p-6 sm:p-7">
        <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.02em]" style={{ color: v("--ux-ink") }}>
          Create your circle
        </h1>
        <p className="mt-2 max-w-[380px] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          Bring people together around shared interests, goals and passions.
        </p>
      </div>

      {/*
        `scene-women-celebrating` used to sit here: a cut-out whose matte had
        gone wrong, so three raised arms each trailed a grey shadow of the
        background it was cut from, on a band that is pale pink. This is a
        painted scene instead — six women with their hands stacked in the
        middle, which is the sentence the quote beside it already says.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CIRCLE_ART.create}
           alt="Six women sitting close together with their hands stacked in the middle"
           loading="lazy" decoding="async" width={900} height={690}
           className="pointer-events-none absolute bottom-0 end-[240px] hidden h-full w-[26%] object-cover object-top xl:block"
           style={{ maskImage: "linear-gradient(100deg, transparent, #000 26%, #000 82%, transparent)",
                    WebkitMaskImage: "linear-gradient(100deg, transparent, #000 26%, #000 82%, transparent)" }} />

      <figure className="absolute end-6 top-1/2 hidden w-[210px] -translate-y-1/2 rounded-[14px] p-3.5 xl:block"
              style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)",
                       boxShadow: "var(--ux-shadow-card)" }}>
        <blockquote className="text-xsm font-bold italic leading-snug"
                    style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
          A small circle can make a big impact.
        </blockquote>
        <figcaption className="mt-1.5 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
          — WomSakhi <Icons.Heart className="h-[11px] w-[11px]" style={{ color: v("--ux-pink-ink") }} />
        </figcaption>
      </figure>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  A card with a name on it                                           */
/* ------------------------------------------------------------------ */

export function Block({ icon, title, sub, children }: {
  icon: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <Card pad={22}>
      <div className="mb-5 flex items-start gap-3">
        <IconTile icon={icon} tint="--ux-brand-tint-2" ink="--ux-brand" size={40} radius={12} />
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>{title}</h2>
          {sub && <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{sub}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Picking a cover                                                    */
/* ------------------------------------------------------------------ */

export function CoverPicker({ cover, onPick, onUpload }: {
  cover: string; onPick: (src: string) => void; onUpload: (f: File) => void;
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Her own photograph, which always beats a stock one. */}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] px-4 py-7 text-center"
             style={{ border: "1.5px dashed var(--ux-brand)", background: v("--ux-brand-tint") }}>
        <input type="file" accept="image/*" className="sr-only" aria-label="Upload a cover image"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        <IconTile icon="ImagePlus" tint="--ux-surface" ink="--ux-brand" size={38} radius={11} />
        <span className="mt-1 text-xsm font-bold" style={{ color: v("--ux-ink") }}>Upload a cover</span>
        <span className="text-2xs" style={{ color: v("--ux-muted") }}>
          Wide works best — about 1440 × 480. JPG or PNG.
        </span>
      </label>

      {/* Or one of ours, so an empty circle never looks abandoned. */}
      <div className="grid grid-cols-3 gap-2">
        {COVER_PRESETS.map((src) => {
          const on = cover === src;
          /* Six buttons that all said "Use this cover" are six identical
             buttons to anyone listening to the page. Each one now says what
             its picture shows, which is the only thing that tells them apart. */
          const shows = COVER_ALT[src] ?? "one of ours";
          return (
            <button key={src} type="button" onClick={() => onPick(src)} aria-pressed={on}
                    aria-label={`Use this cover: ${shows}`}
                    className="ux-press ux-sq relative h-[62px] overflow-hidden rounded-[10px]"
                    style={{ border: `2px solid ${v(on ? "--ux-brand" : "--ux-line")}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" aria-hidden loading="lazy" decoding="async"
                   width={760} height={583} className="h-full w-full object-cover" />
              {on && (
                <span className="absolute end-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full"
                      style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
                  <Icons.Check className="h-[11px] w-[11px]" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tags                                                               */
/* ------------------------------------------------------------------ */

export function TagField({ tags, draft, onDraft, onAdd, onRemove, suggestions }: {
  tags: string[]; draft: string; suggestions: string[];
  onDraft: (s: string) => void; onAdd: (t: string) => void; onRemove: (t: string) => void;
}) {
  const full = tags.length >= 5;
  return (
    <>
      <div className="flex items-center gap-2 rounded-[12px] border px-3.5"
           style={{ borderColor: v("--ux-line"), background: v("--ux-surface"),
                    opacity: full ? 0.6 : 1 }}>
        <Icons.Tag className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-faint") }} />
        <input
          value={draft}
          disabled={full}
          aria-label="Add a tag"
          placeholder={full ? "Five is the most" : "business, handmade, women, india"}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); onAdd(draft); }
          }}
          className="min-h-[46px] w-full bg-transparent text-xsm outline-none"
          style={{ color: v("--ux-ink") }}
        />
      </div>
      <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
        Up to five words that help a woman find this circle. Press Enter after each.
      </p>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => onRemove(t)}
                    aria-label={`Remove ${t}`}
                    className="ux-press ux-sq flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs font-bold"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              #{t}
              <Icons.X className="h-[11px] w-[11px]" />
            </button>
          ))}
        </div>
      )}

      {!full && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => onAdd(s)}
                    className="ux-press ux-sq rounded-full px-2.5 py-1 text-2xs font-semibold"
                    style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what a stranger will see                                     */
/* ------------------------------------------------------------------ */

export function LivePreview({ name, desc, cover, icon, category, privacy, tags, count }: {
  name: string; desc: string; cover: string; icon: string;
  category: string; privacy: string; tags: string[]; count: number;
}) {
  const t = topicOf(category);
  return (
    <Card pad={0} className="overflow-hidden">
      <div className="px-[18px] pb-3 pt-[18px]">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Live preview</h2>
        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
          This is how your circle will look to someone who finds it.
        </p>
      </div>

      <div className="relative grid h-[104px] place-items-center" style={{ background: v(t.tint) }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" aria-hidden loading="lazy" decoding="async"
               className="h-full w-full object-cover" />
        ) : (
          <span className="flex items-center gap-1.5 text-2xs font-semibold" style={{ color: v(t.ink) }}>
            <I name="ImagePlus" className="h-[13px] w-[13px]" />
            Your cover goes here
          </span>
        )}
        <span className="absolute -bottom-6 start-[18px] grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-[16px]"
              style={{ background: v("--ux-tint-pink"), border: `3px solid ${v("--ux-surface")}` }}>
          {icon
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={icon} alt="" aria-hidden className="h-full w-full object-cover" />
            : <I name="UsersRound" className="h-[22px] w-[22px]" style={{ color: v("--ux-pink-ink") }} />}
        </span>
      </div>

      <div className="px-[18px] pb-[18px] pt-8">
        <p className="text-smd font-extrabold leading-snug" style={{ color: v("--ux-ink") }}>
          {name.trim() || "Your circle's name"}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
          <I name={privacy === "public" ? "Globe" : "Lock"} className="h-[12px] w-[12px]" />
          {privacy === "public" ? "Open circle" : privacy === "request" ? "Ask to join" : "Invite only"}
          {" · "}{members(count)} {count === 1 ? "member" : "members"}
        </p>
        <p className="mt-2.5 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          {desc.trim() || "A line about who this circle is for and what happens in it."}
        </p>
        {tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((x) => (
              <span key={x} className="rounded-full px-2.5 py-1 text-3xs font-semibold"
                    style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                {x}
              </span>
            ))}
          </p>
        )}
        <div className="mt-4 rounded-[12px] py-2.5 text-center text-xs font-bold"
             style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))",
                      color: v("--ux-on-brand"), opacity: 0.5 }}
             aria-hidden>
          Join circle
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: six things that make a circle work                           */
/* ------------------------------------------------------------------ */

export function CircleTips({ at }: { at: number }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
        <I name="Lightbulb" className="h-[17px] w-[17px]" style={{ color: v("--ux-amber-ink") }} />
        What makes a circle work
      </h2>
      <ol className="space-y-2.5">
        {CIRCLE_TIPS.map((t, i) => {
          // The first four belong to step 1, so they lead while she is on it.
          const lit = i < 4 ? at === 1 : at > 1;
          return (
            <li key={t} className="flex items-start gap-2.5">
              <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-3xs font-extrabold"
                    style={{ background: v(lit ? "--ux-fill" : "--ux-surface-2"),
                             color: v(lit ? "--ux-on-brand" : "--ux-muted") }}>
                {i + 1}
              </span>
              <span className="text-xs leading-snug" style={{ color: v(lit ? "--ux-ink" : "--ux-muted") }}>
                {t}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: the promise                                                  */
/* ------------------------------------------------------------------ */

export function SafePromise() {
  return (
    <section className="flex items-start gap-3 rounded-[16px] p-[18px]"
             style={{ background: v("--ux-tint-pink") }}>
      <I name="Heart" className="mt-[2px] h-[19px] w-[19px] shrink-0" style={{ color: v("--ux-pink-ink") }} sw={2.4} />
      <div className="min-w-0">
        <p className="text-xsm font-extrabold" style={{ color: v("--ux-pink-ink") }}>
          Safe. Supportive. Meaningful.
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          Every circle is moderated. Anything cruel, or anyone selling what they should not,
          is taken down — and you can report a post from the post itself.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  What is written down, and what is not                              */
/* ------------------------------------------------------------------ */

/**
 * Neither `SourceNote` nor `DemoNote` fits this screen.
 *
 * `SourceNote` means a live fetch failed — it would send her to pull down and
 * retry forever. `DemoNote` means nothing on the screen is real, and here the
 * name, topic and description genuinely are saved. This says the true thing:
 * which fields reach the server today, and which are only in the preview.
 */
export function PartlySaved({ notYet }: { notYet: string }) {
  return (
    <p role="status"
       className="ux-sq mb-1 flex items-start gap-2.5 rounded-[12px] px-3.5 py-2.5 text-xs leading-relaxed"
       style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
      <I name="Info" className="mt-[1px] h-[14px] w-[14px] shrink-0" sw={2} />
      <span>
        Saved with the circle: its name, what it is about, and your description.
        Not yet: {notYet} — you will see {notYet.includes(" and ") ? "them" : "it"} in the preview,
        and can set {notYet.includes(" and ") ? "them" : "it"} again once the circle exists.
      </span>
    </p>
  );
}
