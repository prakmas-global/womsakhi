"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Btn } from "@/components/ux/kit";
import { Chips, Empty, HUE, HealthFrame, I, Panel, useEntries } from "@/components/ux/health/kit";
import { useResource } from "@/lib/use-resource";
import { VIDEO_CATEGORIES, apiHealthVideos, fmtDuration, type HealthVideo } from "@/lib/health-videos-api";
import type { Entry } from "@/lib/health-api";

/**
 * Videos — workout, yoga, meditation and pregnancy videos staff have added
 * (routes/health_videos.py). Favourites and "done" are hers, kept as `vwatch`
 * entries in the Health store. YouTube plays through the privacy-enhanced
 * (nocookie) player.
 */

const TABS = [
  { id: "library", label: "Library" },
  { id: "favorites", label: "Favourites" },
  { id: "completed", label: "Completed" },
];

type Watch = Entry<"vwatch">;

export default function VideosPage() {
  return (
    <HealthFrame active="/app/health/videos" hue="pink" icon="PlayCircle" eyebrow="Videos" tabs={TABS}
                 title="Videos" sub="Workout, yoga, meditation and pregnancy videos, ready to play."
                 art="/ux/art/course-working-laptop-smiling.webp">
      {(tab) => <Library tab={tab} />}
    </HealthFrame>
  );
}

function Library({ tab }: { tab: string }) {
  const params = useSearchParams();
  const first = params.get("cat") || "All";
  const [cat, setCat] = useState<string>(VIDEO_CATEGORIES.includes(first as never) ? first : "All");
  const { data: videos, source } = useResource(useCallback((s: AbortSignal) => apiHealthVideos(s), []), [] as HealthVideo[]);
  const watch = useEntries("vwatch");
  const [playing, setPlaying] = useState<HealthVideo | null>(null);

  const byVideo = useMemo(() => new Map(watch.rows.map((w) => [w.data.video_id, w])), [watch.rows]);
  const mark = async (v: HealthVideo, patch: Partial<Watch["data"]>, msg: string) => {
    const w = byVideo.get(v.id);
    if (w) await watch.edit(w.id, { data: patch }, msg);
    else await watch.add("vwatch", { video_id: v.id, ...patch }, "", msg);
  };

  const shown = videos.filter((v) => {
    const w = byVideo.get(v.id);
    if (tab === "favorites" && !w?.data.favorite) return false;
    if (tab === "completed" && !w?.data.completed) return false;
    return cat === "All" || v.category === cat;
  });
  const loading = source === "loading";

  return (
    <>
      {playing && (
        <Player video={playing} watched={byVideo.get(playing.id)} onClose={() => setPlaying(null)}
                onDone={() => mark(playing, { completed: true }, "Marked as done")}
                onFav={() => mark(playing, { favorite: !byVideo.get(playing.id)?.data.favorite }, byVideo.get(playing.id)?.data.favorite ? "Removed from favourites" : "Saved to favourites")} />
      )}
      <Chips hue="pink" label="Category" value={cat} onChange={setCat} options={["All", ...VIDEO_CATEGORIES]} />
      {loading ? (
        <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading videos…</p>
      ) : !videos.length ? (
        <Panel>
          <Empty icon="PlayCircle" title="Videos are on their way"
                 body="Our team adds workout, yoga, meditation and pregnancy videos here. Until then, the guided routines in Fitness and the calm games work without any video."
                 action={<div className="flex flex-wrap gap-2">
                   <Btn size="sm" href="/app/health/fitness?tab=workouts" icon="Dumbbell">Guided workouts</Btn>
                   <Btn size="sm" variant="outline" href="/app/health/games" icon="Gamepad2">Calm games</Btn>
                 </div>} />
        </Panel>
      ) : !shown.length ? (
        <Panel>
          <Empty icon={tab === "favorites" ? "Heart" : tab === "completed" ? "CircleCheck" : "Search"}
                 title={tab === "favorites" ? "No favourites yet" : tab === "completed" ? "Nothing finished yet" : `No ${cat.toLowerCase()} videos yet`}
                 body={tab === "favorites" ? "Tap the heart on a video to keep it here." : tab === "completed" ? "Videos you finish show up here." : "Try another category."} />
        </Panel>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }} data-video-grid>
          {shown.map((v) => {
            const w = byVideo.get(v.id);
            return (
              <article key={v.id} className="ux-card ux-hov relative flex flex-col overflow-hidden" style={{ padding: 0 }} data-video={v.id}>
                <button type="button" onClick={() => setPlaying(v)} aria-label={`Play ${v.title}`}
                        className="ux-press relative block aspect-video w-full overflow-hidden" style={{ background: "var(--ux-deep)" }}>
                  {v.thumbnail
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={v.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${HUE.pink.ink}, var(--ux-violet))` }} />}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-deep)" }}>
                      <I name="Play" className="ms-0.5 h-5 w-5" />
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
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-[15px] leading-snug" style={{ color: "var(--ux-ink)" }}>{v.title}</b>
                    <button type="button" aria-pressed={!!w?.data.favorite} aria-label={w?.data.favorite ? "Remove from favourites" : "Save to favourites"}
                            onClick={() => mark(v, { favorite: !w?.data.favorite }, w?.data.favorite ? "Removed from favourites" : "Saved to favourites")}
                            className="ux-press -me-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full"
                            style={{ color: w?.data.favorite ? HUE.pink.ink : "var(--ux-muted)" }}>
                      <I name="Heart" className="h-5 w-5" style={w?.data.favorite ? { fill: "currentColor" } : undefined} />
                    </button>
                  </div>
                  <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{[v.category, v.level, v.source].filter(Boolean).join(" · ")}</span>
                  {v.description && <p className="line-clamp-2 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{v.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Player({ video, watched, onClose, onDone, onFav }: {
  video: HealthVideo; watched?: Watch; onClose: () => void; onDone: () => Promise<unknown>; onFav: () => Promise<unknown>;
}) {
  useEffect(() => { document.getElementById("health-video-player")?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [video.id]);
  return (
    <section id="health-video-player" aria-label={`Playing ${video.title}`} className="ux-card flex flex-col gap-3 p-3 sm:p-4"
             style={{ border: `1.5px solid ${HUE.pink.ink}`, scrollMarginTop: "calc(var(--ux-topbar-h,72px) + 12px)" }}>
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
          <Btn size="sm" icon="Check" disabled={!!watched?.data.completed} onClick={onDone}>{watched?.data.completed ? "Done" : "Mark as done"}</Btn>
          <Btn size="sm" variant="ghost" icon="X" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </section>
  );
}
