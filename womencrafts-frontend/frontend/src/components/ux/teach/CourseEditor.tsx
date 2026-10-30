"use client";

import { useRef, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, SectionHead } from "@/components/ux/kit";
import { Area, Choice, Label, More, Picks, Text, Toggle } from "@/components/ux/kit/form";
import { TEACH_CATEGORIES, type CourseInput, type TeachLesson } from "@/lib/teach-api";
import { PicTiles, useMasterPictures } from "@/components/ux/media/MasterPictures";
import { ART_LIBRARY, topicArt } from "@/components/ux/media/art";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";

/**
 * The course form — the same for a new course and an existing one.
 *
 * Three parts, in the order she thinks about them: what it is, what it costs,
 * and the lessons. A paid course needs the UPI ID learners pay; the money goes
 * to her directly and she confirms each payment under Learners.
 *
 * Most answers are a tap: the usual lengths, prices, lesson names and the
 * sentences teachers write about their course. Typing is left for what only
 * she can say — the title, her UPI ID, and the lesson itself.
 */

const COURSE_LENGTHS = ["1 week", "2 weeks", "1 month", "15 minutes a day", "At your own pace"];
const PRICES = [99, 199, 299, 499, 999];
const LESSON_NAMES = ["Introduction", "Tools you need", "Step by step", "Common mistakes", "Practice", "Final piece"];
const LESSON_LENGTHS = ["5 min", "10 min", "15 min", "30 min"];
/** Sentences about a course — tapped into the description, which needs 20 letters. */
const ABOUT = [
  "For complete beginners.", "For women who want to earn from home.", "No machine needed.",
  "You need a sewing machine.", "Learn at your own pace.", "Taught in simple Hindi and English.",
  "Each lesson has a short video.", "By the end you can take paid orders.",
];
/** Add a sentence, or take it out if it is already there. */
const toggleSentence = (text: string, line: string) =>
  text.includes(line) ? text.replace(line, "").replace(/\s{2,}/g, " ").trim() : `${text.trim()} ${line}`.trim();

const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;

export const EMPTY_LESSON: TeachLesson = { title: "", detail: "", duration: "", body: "", video_url: "", preview: false };

/** Lessons anyone can watch before joining — her teaser. */
export const MAX_PREVIEWS = 2;

export const EMPTY_COURSE: CourseInput = {
  name: "", desc: "", category: "", duration: "", price_rupees: 0, upi_id: "", lessons: [{ ...EMPTY_LESSON }], cover: "", publish: true,
};

/** What is missing, in her words — or "" when the course can be saved. */
export function problemsFor(c: CourseInput, paid: boolean): Record<string, string> {
  const p: Record<string, string> = {};
  if (c.name.trim().length < 4) p.name = "Give your course a title of at least 4 letters.";
  if (!c.category) p.category = "Choose a category.";
  if (c.desc.trim().length < 20) p.desc = "Write at least a line or two about who this course is for.";
  if (paid) {
    if (!c.price_rupees || c.price_rupees < 10) p.price = "A paid course costs at least ₹10.";
    else if (c.price_rupees > 50000) p.price = "Keep the price under ₹50,000.";
    if (!UPI_ID.test(c.upi_id.trim())) p.upi = "Add the UPI ID learners should pay, like name@okaxis.";
  }
  c.lessons.forEach((l, i) => {
    if (l.title.trim().length < 2) p[`lesson-${i}`] = "Give this lesson a title.";
    else if (l.video_url && !/^https:\/\//i.test(l.video_url.trim())) p[`lesson-${i}`] = "Video links start with https://";
  });
  return p;
}

function Err({ children }: { children?: string }) {
  return children ? <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{children}</p> : null;
}

export function CourseEditor({ value, onChange, paid, onPaid, problems }: {
  value: CourseInput;
  onChange: (next: CourseInput) => void;
  paid: boolean;
  onPaid: (paid: boolean) => void;
  /** Shown only after she tries to save. */
  problems: Record<string, string>;
}) {
  // Staff control these (Masters → Course categories). A course already in a
  // category staff have since retired keeps it on the list, so saving it
  // doesn't force a change she didn't ask for.
  const catPics = useMasterPictures("course_categories", TEACH_CATEGORIES);
  const cats = catPics.labels;
  const categoryOptions = value.category && !cats.includes(value.category) ? [value.category, ...cats] : cats;
  const set = <K extends keyof CourseInput>(k: K) => (v: CourseInput[K]) => onChange({ ...value, [k]: v });
  const [open, setOpen] = useState(0);
  const lessons = value.lessons;
  const previews = lessons.filter((l) => l.preview).length;
  const setLesson = (i: number, patch: Partial<TeachLesson>) =>
    onChange({ ...value, lessons: lessons.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, lessons: next });
    setOpen(j);
  };
  const remove = (i: number) => {
    onChange({ ...value, lessons: lessons.filter((_, j) => j !== i) });
    setOpen(Math.max(0, i - 1));
  };
  const add = () => {
    onChange({ ...value, lessons: [...lessons, { ...EMPTY_LESSON }] });
    setOpen(lessons.length);
  };

  return (
    <div className="space-y-[16px]">
      <Card>
        <SectionHead title="1. What you will teach" icon="GraduationCap" />
        <div className="space-y-4">
          <div>
            <Label need>Course title</Label>
            <Text value={value.name} onChange={set("name")} label="Course title" max={100}
                  placeholder="e.g. Blouse stitching from scratch" />
            <Err>{problems.name}</Err>
          </div>
          {/* Categories as pictures: the one she taps is the picture her course gets until it has a cover. */}
          <div>
            <Label need>Category</Label>
            <PicTiles label="Category" size="sm" value={value.category} onPick={set("category")}
                      tiles={categoryOptions.map((c) => ({ value: c, label: c, src: catPics.pic(c) }))} />
            <Err>{problems.category}</Err>
          </div>
          <CoverField value={value.cover} onChange={set("cover")}
                      auto={value.category ? catPics.pic(value.category) : ""}
                      about={`${value.name} ${value.category}`} />
          <div>
            <div>
              <Label hint="optional">How long it takes</Label>
              <Text value={value.duration} onChange={set("duration")} label="How long it takes" max={40}
                    placeholder="Tap one below, or type" />
              <Picks options={COURSE_LENGTHS} value={value.duration} label="Course length"
                     onPick={(d) => set("duration")(value.duration === d ? "" : d)} />
            </div>
          </div>
          <div>
            <Label need>Who it is for, and what she will learn</Label>
            <Picks options={ABOUT} value={ABOUT.filter((a) => value.desc.includes(a))} multi label="About the course"
                   onPick={(a) => set("desc")(toggleSentence(value.desc, a))} />
            <p className="mb-2 mt-1.5 text-2xs" style={{ color: "var(--ux-faint)" }}>Tap the ones that fit, then add your own words if you like.</p>
            <Area value={value.desc} onChange={set("desc")} max={1500} rows={4} label="About the course"
                  placeholder="I have stitched blouses for 12 years. In six lessons you will learn to measure, cut and stitch a blouse you can sell." />
            <Err>{problems.desc}</Err>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead title="2. Free or paid" icon="IndianRupee" sub="You decide. Paid courses are paid to you directly." />
        <div className="flex flex-col gap-3 lg:flex-row">
          <Choice icon="Gift" title="Free" sub="Anyone on WomSakhi can join and start at once." on={!paid} onClick={() => onPaid(false)} />
          <Choice icon="IndianRupee" title="Paid" sub="Learners pay you by UPI. You confirm, then the lessons open."
                  on={paid} onClick={() => onPaid(true)} />
        </div>
        {paid && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <Label need>Price</Label>
              <Text value={value.price_rupees ? String(value.price_rupees) : ""} type="number" prefix="₹" label="Price in rupees"
                    onChange={(s) => set("price_rupees")(Math.max(0, Math.floor(Number(s.replace(/\D/g, "")) || 0)))} placeholder="499" />
              <Picks options={PRICES.map((n) => `₹${n}`)} value={value.price_rupees ? `₹${value.price_rupees}` : ""} label="Usual prices"
                     onPick={(x) => set("price_rupees")(Number(x.slice(1)))} />
              <Err>{problems.price}</Err>
            </div>
            <div>
              <Label need>Your UPI ID</Label>
              <Text value={value.upi_id} onChange={set("upi_id")} label="Your UPI ID" max={120} placeholder="name@okaxis" />
              <Err>{problems.upi}</Err>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed lg:col-span-2" style={{ color: "var(--ux-muted)" }}>
              <Icons.ShieldCheck className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "var(--ux-green-ink)" }} />
              Learners see your UPI ID only after they ask to join. WomSakhi takes no fee — every rupee is yours,
              and each confirmed payment is added to your income book in Earn.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionHead title="3. Lessons" icon="ListChecks" sub={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"} · short lessons are finished more often`} />
        <p className="-mt-1 mb-3 flex items-start gap-2 rounded-[12px] p-3 text-xs leading-relaxed"
           style={{ background: "var(--ux-tint-green)", color: "var(--ux-ink-2)" }}>
          <Icons.Eye className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "var(--ux-green-ink)" }} />
          <span>
            <b style={{ color: "var(--ux-ink)" }}>Give a free glimpse.</b> Turn on <b>Free preview</b> for up to {MAX_PREVIEWS} lessons —
            anyone can watch them before joining, like a teaser. A short welcome video works best.
          </span>
        </p>
        <ol className="space-y-2.5">
          {lessons.map((l, i) => {
            const isOpen = open === i;
            const bad = problems[`lesson-${i}`];
            return (
              <li key={i} className="ux-sq overflow-hidden rounded-[14px] border"
                  style={{ borderColor: bad ? "var(--ux-danger-ink)" : isOpen ? "var(--ux-brand)" : "var(--ux-line)" }}>
                <div className="flex items-center gap-2 px-3.5 py-3">
                  <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}
                          className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                          style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xsm font-semibold" style={{ color: l.title ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                      {l.title || "Untitled lesson"}
                    </span>
                    {l.preview && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold"
                            style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Free preview</span>
                    )}
                    {(l.body || l.video_url) && !isOpen && (
                      <span className="shrink-0 text-2xs" style={{ color: "var(--ux-muted)" }}>
                        {[l.body && "Text", l.video_url && "Video"].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}
                          className="grid h-8 w-8 place-items-center rounded-[8px] disabled:opacity-30" style={{ color: "var(--ux-muted)" }}>
                    <Icons.ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === lessons.length - 1} onClick={() => move(i, 1)}
                          className="grid h-8 w-8 place-items-center rounded-[8px] disabled:opacity-30" style={{ color: "var(--ux-muted)" }}>
                    <Icons.ChevronDown className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Remove lesson" disabled={lessons.length === 1} onClick={() => remove(i)}
                          className="grid h-8 w-8 place-items-center rounded-[8px] disabled:opacity-30" style={{ color: "var(--ux-danger-ink)" }}>
                    <Icons.Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-3.5 border-t px-3.5 pb-4 pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                    <div className="grid gap-3.5 lg:grid-cols-[1fr_220px]">
                      <div>
                        <Label need>Lesson title</Label>
                        <Text value={l.title} onChange={(s) => setLesson(i, { title: s })} label={`Lesson ${i + 1} title`} max={100}
                              placeholder="e.g. Taking measurements" />
                        {!l.title.trim() && (
                          <Picks options={LESSON_NAMES} value="" label="Lesson names" onPick={(t) => setLesson(i, { title: t })} />
                        )}
                      </div>
                      <div>
                        <Label hint="optional">Length</Label>
                        <Picks options={LESSON_LENGTHS} value={l.duration} label="Lesson length"
                               onPick={(d) => setLesson(i, { duration: l.duration === d ? "" : d })} />
                      </div>
                    </div>
                    <div>
                      <Label hint="optional — YouTube works best">Video link</Label>
                      <Text value={l.video_url} onChange={(s) => setLesson(i, { video_url: s.trim() })} label="Video link" max={300}
                            placeholder="Paste the https://youtu.be/… link" />
                    </div>
                    {/* With a video, words are extra — folded away until she wants them. */}
                    <More label={l.video_url ? "Add words to go with the video (optional)" : "Write the lesson"}
                          open={!l.video_url || !!(l.body || l.detail)}>
                      <div className="space-y-3.5">
                        <div>
                          <Label hint="optional">One line about it</Label>
                          <Text value={l.detail} onChange={(s) => setLesson(i, { detail: s })} label="One line" max={300}
                                placeholder="Bust, waist, shoulder and length" />
                        </div>
                        <div>
                          <Label>The lesson</Label>
                          <Area value={l.body} onChange={(s) => setLesson(i, { body: s })} max={8000} rows={6} label="Lesson text"
                                placeholder="Explain it the way you would to a friend. Leave an empty line between paragraphs." />
                        </div>
                      </div>
                    </More>
                    <div className="rounded-[12px] border p-3" style={{ borderColor: l.preview ? "var(--ux-green-ink)" : "var(--ux-line)" }}>
                      <Toggle
                        on={l.preview}
                        onChange={(on) => { if (!on || previews < MAX_PREVIEWS) setLesson(i, { preview: on }); }}
                        label="Free preview"
                        sub={l.preview
                          ? "Anyone can watch this lesson before joining."
                          : previews >= MAX_PREVIEWS
                            ? `You already have ${MAX_PREVIEWS} free previews. Turn one off to use this lesson instead.`
                            : "Let anyone watch this lesson before joining — a teaser for your course."}
                      />
                    </div>
                    <Err>{bad}</Err>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-3">
          <Btn variant="soft" icon="Plus" onClick={add} disabled={lessons.length >= 40}>Add a lesson</Btn>
        </div>
      </Card>
    </div>
  );
}

/**
 * The course's thumbnail — the picture on its card in Learn.
 *
 * Her own photo first: of her work, her table, her hands at the machine —
 * nothing tells a learner more about a course. Failing that, a picture from
 * the app's library, the ones her title and category point to first. Left
 * alone, the course shows its category's picture, as every course did before
 * it could have its own. Two taps either way; nothing to type.
 */
function CoverField({ value, onChange, auto, about }: {
  value: string; onChange: (src: string) => void; auto: string; about: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const shown = value || auto;
  const own = !!value && !value.startsWith("/ux/");

  // What her words point to first, then the library's teaching and work pictures.
  const suggested = [topicArt(about), auto, ...ART_LIBRARY
    .filter((a) => /^\/ux\/art\/(course|work-dashboard|scene-woman)/.test(a.src)).map((a) => a.src)]
    .filter((src, i, all) => src && all.indexOf(src) === i).slice(0, 10);

  const upload = async (file?: File | null) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) { setError(problem); return; }
    setError(""); setBusy(1);
    try {
      const saved = await apiUploadImage(file, "cover", (p) => setBusy(Math.max(1, p)));
      onChange(saved.url);
    } catch (e) {
      setError(uploadErrorMessage(e));
    } finally {
      setBusy(0);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <Label hint="optional">Course picture</Label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* What learners will see on the card. */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-[14px]" style={{ background: "var(--ux-surface-2)" }}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Your course picture" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-xs" style={{ color: "var(--ux-faint)" }}>
              <Icons.Image className="mb-1 h-7 w-7" />
            </span>
          )}
          <span className="absolute start-2 top-2 rounded-full px-2.5 py-1 text-2xs font-bold text-white"
                style={{ background: "rgba(16,6,24,.62)" }}>
            {own ? "Your photo" : value ? "Chosen picture" : auto ? "Category picture" : "Choose a category"}
          </span>
          {busy > 0 && (
            <span className="absolute inset-0 grid place-items-center text-sm font-bold text-white" style={{ background: "rgba(16,6,24,.6)" }}>
              <span className="flex flex-col items-center gap-1"><Icons.Loader2 className="h-6 w-6 animate-spin" />{busy}%</span>
            </span>
          )}
        </div>

        {/* Her own photo — the camera on a phone, a file on a laptop. */}
        <div className="flex flex-col gap-2">
          <label className="ux-press flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] px-4 py-5 text-center"
                 style={{ border: "1.5px dashed var(--ux-brand)", background: "var(--ux-brand-tint)" }}>
            <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Add a photo for your course"
                   onChange={(e) => void upload(e.target.files?.[0])} />
            <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--ux-surface)", color: "var(--ux-brand)" }}>
              <Icons.Camera className="h-5 w-5" />
            </span>
            <span className="text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{own ? "Change photo" : "Add your photo"}</span>
            <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>Your work, your hands, your table — wide works best.</span>
          </label>
          {value && (
            <button type="button" onClick={() => onChange("")}
                    className="ux-press flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-xs font-semibold"
                    style={{ border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
              <Icons.RotateCcw className="h-3.5 w-3.5" /> Use the category picture
            </button>
          )}
        </div>
      </div>
      {error && <Err>{error}</Err>}

      {/* Or one of ours. */}
      <p className="mb-1.5 mt-3 text-2xs font-semibold" style={{ color: "var(--ux-muted)" }}>Or tap one of these</p>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Pictures for your course">
        {suggested.map((src) => {
          const on = value === src;
          return (
            <button key={src} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? "" : src)}
                    aria-label={on ? "Chosen picture" : "Use this picture"}
                    className="ux-press relative h-[64px] w-[92px] shrink-0 snap-start overflow-hidden rounded-[10px]"
                    style={{ border: `2px solid ${on ? "var(--ux-brand)" : "transparent"}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              {on && (
                <span className="absolute end-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full"
                      style={{ background: "var(--ux-fill)", color: "var(--ux-on-brand)" }}>
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
