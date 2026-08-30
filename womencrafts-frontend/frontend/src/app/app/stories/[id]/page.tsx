"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  ActionBtn, Btn, Card, copy, EmptyState, Pill, RailSkeleton, ScreenSkeleton,
  SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { apiLikeStory, apiStories, apiStory, type Story } from "@/lib/community-api";
import { useResource } from "@/lib/use-resource";


/**
 * One woman's story.
 *
 * The point of this screen is that it is REACHABLE, not admirable. Every story
 * ends with the specific thing that worked and a way to do the same — a page
 * that leaves her impressed and no closer to acting has failed.
 *
 * **Almost nothing on it used to be the story it claimed to be.** It read the
 * story out of the list hook, whose mapper spreads a fixture and overrides only
 * six fields — so every woman's story was captioned with Sunita Devi's trade
 * ("Tailoring"), her address ("Sector 12, Jaipur"), her distance ("1.2 km
 * away") and her income ("₹18,000 a month"). The rail told the reader "she is
 * 1.2 km from you and answers most messages", and two paragraphs of invented
 * first-person prose were printed under her body text as though she had
 * written them. This reads `/community/stories/{id}` instead, and shows only
 * what that returns.
 */
export default function StoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: s, source } = useResource(
    useCallback(() => apiStory(id), [id]),
    null as Story | null,
  );
  // Only for the two suggestions at the bottom. Read from the endpoint, not
  // from `useStories` — that hook's mapper spreads a fixture, and the names
  // beside it would have carried a stranger's trade and distance again.
  const { data: STORIES } = useResource(
    useCallback(() => apiStories(), []),
    [] as Story[],
  );

  const [like, setLike] = useState<{ n: number; mine: boolean } | null>(null);
  const [liking, setLiking] = useState(false);
  const [likeProblem, setLikeProblem] = useState("");

  async function toggleLike() {
    if (!s || liking) return;
    setLiking(true);
    setLikeProblem("");
    try {
      const got = await apiLikeStory(s.id);
      setLike({ n: got.likes, mine: got.liked_by_me });
    } catch {
      setLikeProblem("That did not reach us. Your like was not recorded.");
    } finally {
      setLiking(false);
    }
  }

  // "Not listed" is a claim, and it cannot be made while the answer is still
  // on its way — saying it during the fetch makes the screen flash "that is
  // not here" before showing itself.
  if (!s && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!s) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title="That story is not here"
            body="She may have taken it down. The others are still up."
            action={<Btn href="/app/stories" variant="primary" iconEnd="ArrowRight">All stories</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const others = STORIES.filter((x) => x.id !== s.id).slice(0, 2);
  const liked = like?.mine ?? s.liked_by_me;
  const likeCount = like?.n ?? s.likes;

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          {/*
            * A "What actually worked" card stood here with three rows in it —
            * what changed her life, how long it took, and what she earns now —
            * all decided by a switch on a fixture's trade field. None of the
            * three is anywhere in this API. The programme she names in her own
            * story is, and that is the one thing here she can actually follow.
            */}
          {s.program && (
            <Card>
              <SectionHead title="What she did" sub="The specific thing, not the inspiration" />
              <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                {s.program}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                She names this in her story. It is open to you too.
              </p>
              <div className="mt-3.5">
                <Btn href="/app/learn" variant="primary" full iconEnd="ArrowRight">Find it</Btn>
              </div>
            </Card>
          )}

          <Card>
            <SectionHead title="Getting in touch" />
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              WomSakhi has no direct messages between members yet. Ask the team about
              {" "}{s.author_name.split(" ")[0]} and they will answer you in Messages.
            </p>
            <div className="mt-3.5 flex gap-2">
              <Btn href="/app/messages" variant="soft" size="sm" icon="MessageCircle">Ask the team</Btn>
              <Btn href="/app/circles" variant="outline" size="sm">Find a circle</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <Link href="/app/stories"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Sakhi Local
      </Link>

      <Card className="mb-[15px] overflow-hidden" pad={0}>
        <div className="relative h-[240px] overflow-hidden" style={{ background: "var(--ux-tint-lilac)" }}>
          {s.cover && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={s.cover} alt="" className="h-full w-full object-cover" />
          )}
          {/* The scrim is on the text's own container, so white stays readable
              even if the cover fails to load — or, as here, if there is none. */}
          <div className="absolute bottom-0 start-0 end-0 flex items-end gap-3.5 px-5 pb-5 pt-16"
               style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0.4) 45%, transparent)" }}>
            {s.author_avatar
              ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={s.author_avatar} alt=""
                     className="h-[62px] w-[62px] shrink-0 rounded-full border-2 border-white object-cover" />
              )
              : (
                <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border-2 border-white text-[24px] font-semibold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                  {s.author_name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            <div className="min-w-0 flex-1">
              <p className="text-[20px] font-bold text-white">{s.author_name}</p>
              <p className="mt-1 text-[12.5px]" style={{ color: "rgba(255,255,255,0.88)" }}>{s.when}</p>
            </div>
            {s.featured && <Pill tone="green" size="sm">Featured</Pill>}
          </div>
        </div>

        <div className="p-[22px]">
          {s.title && (
            <p className="text-[20px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
              &ldquo;{s.title}&rdquo;
            </p>
          )}
          {/* Her body, and only her body. Two paragraphs beginning "The hardest
              part was not the work" were printed here under every story, in the
              first person, above her own name. */}
          <div className="mt-4 whitespace-pre-line text-[14px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            {s.body}
          </div>

          {likeProblem && (
            <p role="alert" className="ux-slide-up mt-3.5 text-[12.5px]" style={{ color: "var(--ux-orange-ink)" }}>
              {likeProblem}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
            <p className="text-[11.5px]" style={{ color: "var(--ux-faint)" }}>{s.when}</p>
            <span className="flex items-center gap-2">
              {/* Was `setLiked((v) => !v)` and nothing else — a counter that
                  went up on her screen alone. */}
              <button
                onClick={() => void toggleLike()}
                disabled={liking}
                aria-pressed={liked}
                aria-label={liked ? "Remove your like" : "Like this story"}
                className="ux-press ux-hov ux-sq inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2.5 text-[12.5px] font-medium"
                style={{ background: liked ? "var(--ux-tint-pink)" : "var(--ux-surface-2)",
                         color: liked ? "var(--ux-pink-ink)" : "var(--ux-muted)" }}
              >
                {/* `currentColor`, not a token: the button already carries
                    the pink, and a filled heart has to be distinguishable
                    from an unfilled one by anything reading the DOM. */}
                <Icons.Heart className="ux-ico h-[15px] w-[15px]"
                             fill={liked ? "currentColor" : "none"} strokeWidth={1.9} />
                {likeCount}
              </button>
              <ActionBtn variant="outline" size="sm" icon="Share2" doneIcon="Copy" done="Link copied"
                        act={() => copy(`https://womsakhi.in/story/${s.id}`, "Link copied — send it to anyone", "Copy it by hand from the address bar")}>
                Share
              </ActionBtn>
            </span>
          </div>
        </div>
      </Card>

      {others.length > 0 && (
        <div>
          <SectionHead title="More women on WomSakhi" />
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {others.map((o, i) => (
              <Card key={o.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-[48px] w-[48px] shrink-0 place-items-center overflow-hidden rounded-full text-[18px] font-semibold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                    {o.author_avatar
                      ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={o.author_avatar} alt="" className="ux-art h-full w-full object-cover" />
                      )
                      : o.author_name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{o.author_name}</h3>
                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{o.when}</p>
                  </div>
                  <Btn href={`/app/stories/${o.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Read</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </HomeShell>
  );
}
