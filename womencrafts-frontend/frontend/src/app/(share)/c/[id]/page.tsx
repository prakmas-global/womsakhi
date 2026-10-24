import type { Metadata } from "next";

import { Btn, Card, EmptyState } from "@/components/ux/kit";
import * as Icons from "@/components/ux/icons";
import { apiBase } from "@/lib/api-base";
import type { PublicCourse } from "@/lib/share-api";

/**
 * A course, from a link someone shared — `/c/<id>`.
 *
 * The app shared `womsakhi.com/course/<id>` and no such page existed. This
 * reads `GET /public/courses/{id}` on the server: the course and its teacher's
 * first name, nothing about any learner. One way in — sign in, and land on the
 * course itself.
 */

export const metadata: Metadata = { title: "A course on WomSakhi" };
export const revalidate = 60;

const ART: Record<string, string> = {
  "Digital Literacy": "/ux/art/course-working-laptop-smiling.webp",
  Entrepreneurship: "/ux/art/course-handmade-market-stall.webp",
  Handicrafts: "/ux/art/course-sewing-machine.webp",
  "Personal Development": "/ux/art/course-presenting-to-group.webp",
  "Health & Wellness": "/ux/art/course-meditation.webp",
  "Cooking & Food": "/ux/art/course-cooking-packing-orders.webp",
  "Beauty & Care": "/ux/art/course-teaching-another-woman.webp",
  "Money & Savings": "/ux/art/course-counting-coins-calculator.webp",
  Languages: "/ux/art/course-confident-microphone.webp",
};

export default async function SharedCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let c: PublicCourse | null = null;
  try {
    const res = await fetch(`${apiBase()}/public/courses/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 }, signal: AbortSignal.timeout(6000),
    });
    if (res.ok) c = (await res.json()) as PublicCourse;
  } catch {
    c = null;
  }
  if (!c) {
    return (
      <Card>
        <EmptyState icon="SearchX" title="This course is not open right now"
                    body="The link may be old, or the course has been taken down. There are many more on WomSakhi."
                    action={<Btn href="/signin?next=/app/programs" variant="primary">See courses on WomSakhi</Btn>} />
      </Card>
    );
  }
  const next = `/app/programs/${c.id}`;
  const price = c.price_minor ? `₹${(c.price_minor / 100).toLocaleString("en-IN")}` : "Free";
  return (
    <Card pad={0} className="overflow-hidden">
      <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ background: "#1c1024" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ART[c.category] ?? "/ux/art/course-reading-open-book.webp"} alt="" className="h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 35%, rgba(16,6,24,.9))" }} />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <span className="inline-block rounded-full px-2.5 py-1 text-2xs font-bold"
                style={{ background: c.price_minor ? "rgba(255,255,255,.92)" : "var(--ux-green-ink)", color: c.price_minor ? "#24132e" : "#fff" }}>{price}</span>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-white">{c.name}</h1>
          <p className="mt-1 text-sm text-white/85">
            {c.by_member ? `Taught by ${c.teacher}, a WomSakhi member` : "By the WomSakhi team"} · {c.category}
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>
          <span className="inline-flex items-center gap-1"><Icons.CirclePlay className="h-3.5 w-3.5" />{c.lessons} {c.lessons === 1 ? "lesson" : "lessons"}</span>
          {c.duration && <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" />{c.duration}</span>}
          {c.enrolled > 0 && <span className="inline-flex items-center gap-1"><Icons.Users className="h-3.5 w-3.5" />{c.enrolled} learning</span>}
        </p>
        {c.desc && <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{c.desc}</p>}
        {c.lesson_titles.length > 0 && (
          <ol className="mt-4 space-y-1.5">
            {c.lesson_titles.map((t, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--ux-ink)" }}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-2xs font-bold"
                      style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>{i + 1}</span>
                {t || `Lesson ${i + 1}`}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-5">
          <Btn href={`/signin?next=${encodeURIComponent(next)}`} variant="primary" full iconEnd="ArrowRight">
            {c.price_minor ? "See it on WomSakhi" : "Start it free on WomSakhi"}
          </Btn>
          <p className="mt-2 text-center text-2xs" style={{ color: "var(--ux-faint)" }}>
            WomSakhi is for women. Sign in or join with your mobile number.
          </p>
        </div>
      </div>
    </Card>
  );
}
