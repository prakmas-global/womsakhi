import type { Metadata } from "next";

import { Btn, Card, EmptyState } from "@/components/ux/kit";
import { apiBase } from "@/lib/api-base";
import type { PublicStory } from "@/lib/share-api";

/**
 * A member's published story, from a shared link — `/story/<id>`.
 *
 * Only stories the team has published, under the name the author chose to
 * show — her first name, or "A WomSakhi member". The app used to share a
 * `womsakhi.com/story/<id>` address that went nowhere.
 */

export const metadata: Metadata = { title: "A story from WomSakhi" };
export const revalidate = 300;

export default async function SharedStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let s: PublicStory | null = null;
  try {
    const res = await fetch(`${apiBase()}/public/stories/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 }, signal: AbortSignal.timeout(6000),
    });
    if (res.ok) s = (await res.json()) as PublicStory;
  } catch {
    s = null;
  }
  if (!s) {
    return (
      <Card>
        <EmptyState icon="SearchX" title="This story is not here"
                    body="The link may be old. Women share new stories on WomSakhi every week."
                    action={<Btn href="/signin?next=/app/stories" variant="primary">Read stories on WomSakhi</Btn>} />
      </Card>
    );
  }
  return (
    <Card pad={0} className="overflow-hidden">
      {s.cover && (
        <div className="aspect-[16/9] w-full overflow-hidden" style={{ background: "var(--ux-tint-lilac)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.cover} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <article className="p-5 sm:p-6">
        <p className="text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ux-brand)" }}>A WomSakhi story</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight" style={{ color: "var(--ux-ink)" }}>{s.title}</h1>
        <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>
          {s.author}{s.when ? ` · ${s.when}` : ""}{s.program ? ` · ${s.program}` : ""}
        </p>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          {s.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <div className="mt-6 rounded-[14px] p-4" style={{ background: "var(--ux-brand-tint)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Start your own story</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            Learn a skill, find work, sell what you make — with women who have done it.
          </p>
          <div className="mt-3">
            <Btn href={`/signin?next=${encodeURIComponent(`/app/stories/${s.id}`)}`} variant="primary" iconEnd="ArrowRight">Join WomSakhi</Btn>
          </div>
        </div>
      </article>
    </Card>
  );
}
