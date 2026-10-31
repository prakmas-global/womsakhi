"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiAddEntry, today, type Entry } from "@/lib/health-api";
import { apiHealthVideos, fmtDuration, type HealthVideo, type VideoCategory } from "@/lib/health-videos-api";
import { useResource } from "@/lib/use-resource";
import { Chips, Empty, HUE, I, Panel, useEntries, type Hue } from "./kit";

/**
 * Watch & listen — the videos for one Health & Wellness section, inside that
 * section (the design folds the old Videos page into each section's own tab).
 * Videos come from routes/health_videos.py; saved, finished and how far she
 * got are hers, kept as `vwatch` entries. Finishing a movement video also logs
 * a workout, and a calming one logs a calm activity, so it counts in Fitness
 * and Mental Wellness.
 */

export type VideoSection = "home" | "fitness" | "nutrition" | "sleep" | "mental" | "fertility" | "pregnancy" | "mentor" | "doctor";

export const SECTION_VIDEOS: Record<VideoSection, VideoCategory[]> = {
  home: [],
  fitness: ["Workout", "Yoga"],
  nutrition: ["Nutrition"],
  sleep: ["Sleep"],
  mental: ["Meditation"],
  fertility: ["Fertility"],
  pregnancy: ["Pregnancy"],
  mentor: ["Mentoring"],
  doctor: ["Health talks"],
};

const MOVE: VideoCategory[] = ["Workout", "Yoga"];
const CALM: VideoCategory[] = ["Meditation", "Sleep"];

type Watch = Entry<"vwatch">;

export function WatchListen({ section, hue, title = "Watch & listen", sub, compact = false, allHref, hideWhenEmpty = false }: {
  section: VideoSection;
  hue: Hue;
  title?: string;
  sub?: string;
  /** A short strip of three with "See all", for an Overview or Workouts tab. */
  compact?: boolean;
  /** Where "See all" goes in compact mode, normally this section's ?tab=watch. */
  allHref?: string;
  /** Draw nothing until there is a video (Health home). */
  hideWhenEmpty?: boolean;
}) {
  const cats = SECTION_VIDEOS[section];
  const { data: all, source } = useResource(useCallback((s: AbortSignal) => apiHealthVideos(s), []), [] as HealthVideo[]);
  const watch = useEntries("vwatch");
  const [filter, setFilter] = useState("All");
  const [playing, setPlaying] = useState<HealthVideo | null>(null);

  const videos = useMemo(() => all.filter((v) => !cats.length || cats.includes(v.category)), [all, cats]);
  const byVideo = useMemo(() => new Map(watch.rows.map((w) => [w.data.video_id, w])), [watch.rows]);

  const mark = async (v: HealthVideo, patch: Partial<Watch["data"]>, msg: string) => {
    const w = byVideo.get(v.id);
    if (w) await watch.edit(w.id, { data: patch }, msg);
    else await watch.add("vwatch", { video_id: v.id, ...patch }, "", msg);
  };

  const complete = async (v: HealthVideo) => {
    if (byVideo.get(v.id)?.data.completed) return;
    await mark(v, { completed: true }, "Marked as completed");
    const minutes = Math.max(1, Math.round(v.duration_sec / 60));
    try {
      if (MOVE.includes(v.category)) {
        await apiAddEntry("workout", { activity: v.category === "Yoga" ? "Yoga" : "Workout", minutes, routine: v.title }, today());
        toast(`${minutes} min saved to your Fitness progress`, { tone: "success" });
      } else if (CALM.includes(v.category)) {
        await apiAddEntry("activity", { type: v.category === "Sleep" ? "Wind-down" : "Meditation", minutes }, today());
        toast(`${minutes} min saved to your calm minutes`, { tone: "success" });
      }
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    }
  };
  const fav = (v: HealthVideo) => {
    const on = !!byVideo.get(v.id)?.data.favorite;
    return mark(v, { favorite: !on }, on ? "Removed from saved" : "Saved");
  };

  const shown = videos.filter((v) => {
    const w = byVideo.get(v.id);
    return filter === "All" || (filter === "Saved" ? !!w?.data.favorite : !!w?.data.completed);
  });
  const featured = shown.find((v) => !byVideo.get(v.id)?.data.completed) ?? shown[0];
  const rest = compact ? shown.filter((v) => v.id !== featured?.id).slice(0, 2) : shown.filter((v) => v.id !== featured?.id);
  const loading = source === "loading";
  if (hideWhenEmpty && (loading || !videos.length)) return null;

  return (
    <Panel title={title} sub={sub ?? (loading ? "Loading…" : `${videos.length} ${videos.length === 1 ? "video" : "videos"}`)}
           action={compact && allHref && videos.length > 3
             ? <Btn size="sm" variant="ghost" iconEnd="ArrowRight" href={allHref}>See all {videos.length}</Btn> : undefined}>
      {playing && (
        <Player video={playing} watched={byVideo.get(playing.id)} hue={hue} onClose={() => setPlaying(null)}
                onDone={() => complete(playing)} onFav={() => fav(playing)} />
      )}
      {!compact && videos.length > 0 && (
        <Chips label="Show" hue={hue} value={filter} onChange={setFilter} options={["All", "Saved", "Completed"]} />
      )}
      {loading ? (
        <div className="h-[180px] animate-pulse rounded-[14px]" style={{ background: "var(--ux-surface-2)" }} />
      ) : !videos.length ? (
        <Empty icon="PlayCircle" title="Videos are on their way"
               body="Our team adds short, checked videos for this section. They will appear here, ready to play." />
      ) : !shown.length ? (
        <Empty icon={filter === "Saved" ? "Heart" : "CircleCheck"} title={filter === "Saved" ? "Nothing saved yet" : "Nothing finished yet"}
               body={filter === "Saved" ? "Tap the heart on a video to keep it here." : "Videos you finish show up here."}
               action={<Btn size="sm" variant="outline" onClick={() => setFilter("All")}>Show all</Btn>} />
      ) : (
        <div className="@container flex flex-col gap-3">
          {/* Up next: the picture, and its words beside it in a wide panel or under it in a
              narrow one. Never over it — most thumbnails carry words of their own — and never
              stretched to fill the page. */}
          {featured && !playing && (
            <button type="button" onClick={() => setPlaying(featured)} aria-label={`Play ${featured.title}`}
                    className="ux-press group grid w-full overflow-hidden rounded-[14px] text-start @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
                    style={{ background: "var(--ux-deep)" }}>
              <span className="relative block aspect-video w-full overflow-hidden">
                <Thumb v={featured} hue={hue} big />
                <span className="absolute inset-0 grid place-items-center"><PlayDot /></span>
                <span className="absolute bottom-2 end-2 rounded-[6px] px-1.5 py-0.5 text-xs font-bold tabular-nums text-white @3xl:hidden" style={{ background: "rgba(12,8,22,.75)" }}>
                  {fmtDuration(featured.duration_sec)}
                </span>
              </span>
              <span className="flex min-w-0 flex-col justify-center gap-1.5 p-4 @3xl:gap-2 @3xl:p-6">
                <UpNext done={!!byVideo.get(featured.id)?.data.completed} hue={hue} />
                <b className="block text-base leading-snug text-white @3xl:text-xl">{featured.title}</b>
                <span className="text-xs text-white/75 @3xl:text-sm">{[featured.category, featured.level, fmtDuration(featured.duration_sec)].filter(Boolean).join(" · ")}</span>
                {featured.source && <span className="hidden text-xs text-white/60 @3xl:block">{featured.source}</span>}
                <span className="mt-2 hidden w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold @3xl:inline-flex"
                      style={{ background: "rgba(255,255,255,.94)", color: "var(--ux-deep)" }}>
                  <I name="Play" className="h-4 w-4" /> Play now
                </span>
              </span>
            </button>
          )}
          {rest.length > 0 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
              {rest.map((v) => <Card key={v.id} v={v} w={byVideo.get(v.id)} hue={hue} onPlay={() => setPlaying(v)} onFav={() => void fav(v)} />)}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function UpNext({ done, hue }: { done: boolean; hue: Hue }) {
  return (
    <span className="mb-1 inline-block w-fit rounded-full px-2 py-0.5 text-2xs font-extrabold uppercase tracking-[0.08em]"
          style={{ background: HUE[hue].tint, color: HUE[hue].ink }}>{done ? "Watch again" : "Up next"}</span>
  );
}

function PlayDot() {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-deep)" }}>
      <I name="Play" className="ms-0.5 h-5 w-5" />
    </span>
  );
}

function Thumb({ v, hue, big }: { v: HealthVideo; hue: Hue; big?: boolean }) {
  // Staff may add a picture; a YouTube video without one shows YouTube's own still.
  // A big picture asks for the 1280px still and a card for the 640px one, so both stay sharp on
  // high-density screens. Not every video has them: YouTube then sends a 120px grey placeholder
  // (or a 404), so anything that small steps down — 1280 → 640 → 480, which every video has.
  // A saved thumbnail that is only YouTube's own still counts as none, so it gets the right size too.
  const yt = (size: string) => `https://i.ytimg.com/vi/${v.youtube_id}/${size}.jpg`;
  const custom = v.thumbnail && !(v.youtube_id && /(^|\/\/)i\d?\.ytimg\.com\/vi\//.test(v.thumbnail)) ? v.thumbnail : "";
  const src = custom || (v.youtube_id ? yt(big ? "maxresdefault" : "sddefault") : "");
  const fallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!v.youtube_id || !(e.type === "error" || img.naturalWidth <= 120)) return;
    if (img.src.endsWith("/maxresdefault.jpg")) img.src = yt("sddefault");
    else if (img.src.endsWith("/sddefault.jpg")) img.src = yt("hqdefault");
  };
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" loading="lazy" onLoad={fallback} onError={fallback} className="absolute inset-0 h-full w-full object-cover" />
    : <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${HUE[hue].ink}, var(--ux-violet))` }} />;
}

function Card({ v, w, hue, onPlay, onFav }: { v: HealthVideo; w?: Watch; hue: Hue; onPlay: () => void; onFav: () => void }) {
  return (
    <article className="ux-card ux-hov flex flex-col overflow-hidden" style={{ padding: 0 }}>
      <button type="button" onClick={onPlay} aria-label={`Play ${v.title}`}
              className="ux-press relative block aspect-video w-full overflow-hidden" style={{ background: "var(--ux-deep)" }}>
        <Thumb v={v} hue={hue} />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-deep)" }}>
            <I name="Play" className="ms-0.5 h-4 w-4" />
          </span>
        </span>
        <span className="absolute bottom-2 end-2 rounded-[6px] px-1.5 py-0.5 text-xs font-bold tabular-nums text-white" style={{ background: "rgba(12,8,22,.75)" }}>
          {fmtDuration(v.duration_sec)}
        </span>
        {w?.data.completed && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold"
                style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            <I name="Check" className="h-3 w-3" /> Done
          </span>
        )}
      </button>
      <div className="flex items-start justify-between gap-2 p-3">
        <span className="min-w-0">
          <b className="block text-sm leading-snug" style={{ color: "var(--ux-ink)" }}>{v.title}</b>
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{[v.level, v.source].filter(Boolean).join(" · ") || v.category}</span>
        </span>
        <button type="button" aria-pressed={!!w?.data.favorite} aria-label={w?.data.favorite ? "Remove from saved" : "Save"} onClick={onFav}
                className="ux-press -me-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ color: w?.data.favorite ? HUE[hue].ink : "var(--ux-muted)" }}>
          <I name="Heart" className="h-5 w-5" style={w?.data.favorite ? { fill: "currentColor" } : undefined} />
        </button>
      </div>
    </article>
  );
}

function Player({ video, watched, hue, onClose, onDone, onFav }: {
  video: HealthVideo; watched?: Watch; hue: Hue; onClose: () => void; onDone: () => Promise<unknown>; onFav: () => Promise<unknown>;
}) {
  useEffect(() => { document.getElementById(`wl-${video.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [video.id]);
  return (
    <section id={`wl-${video.id}`} aria-label={`Playing ${video.title}`} className="flex flex-col gap-3 rounded-[14px] p-3"
             style={{ border: `1.5px solid ${HUE[hue].ink}`, scrollMarginTop: "calc(var(--ux-topbar-h,72px) + 12px)" }}>
      <div className="aspect-video w-full overflow-hidden rounded-[12px]" style={{ background: "var(--ux-media-bed)" }}>
        {video.youtube_id ? (
          <iframe title={video.title} className="h-full w-full" allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1&rel=0&modestbranding=1`} />
        ) : (
          <video className="h-full w-full" src={video.url} controls autoPlay playsInline onEnded={() => void onDone()} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block text-base" style={{ color: "var(--ux-ink)" }}>{video.title}</b>
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{video.category} · {fmtDuration(video.duration_sec)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="outline" icon="Heart" onClick={onFav}>{watched?.data.favorite ? "Saved" : "Save"}</Btn>
          <Btn size="sm" icon="Check" disabled={!!watched?.data.completed} onClick={onDone}>{watched?.data.completed ? "Completed" : "Mark as completed"}</Btn>
          <Btn size="sm" variant="ghost" icon="X" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </section>
  );
}
