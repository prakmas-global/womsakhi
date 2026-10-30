"use client";

import { useMemo } from "react";

import { masterPicture, useMaster } from "@/lib/masters-api";
import { pictureOr } from "@/components/ux/media/MasterPictures";
import { SUGGESTED_TAGS, TOPICS, liveTopics, type LiveTopics, type Topic } from "./data";

/**
 * Circle topics and suggested tags from Masters (staff control them; backend
 * app/core/masters.py). The built-in seven and twelve show until the lists
 * load, and stay if they can't. Each topic carries its picture.
 */
export function useCircleTopics(): LiveTopics | undefined {
  const { items, loaded } = useMaster("circle_topics");
  const sig = items.map((i) => `${i.key}:${i.label}:${i.extra.image ?? ""}`).join("|");
  return useMemo(() => {
    if (!loaded) return undefined;
    const live = liveTopics(items);
    return {
      ...live,
      topics: live.topics.map((t, i) => ({ ...t, pic: masterPicture("circle_topics", items[i]), picByStaff: !!items[i].extra.image })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded]);
}

/** The topic list to offer: the master's once loaded, the built-in seven until then. */
export function useCircleTopicList() {
  return useCircleTopics()?.topics ?? TOPICS;
}

export function useCircleTags(): string[] {
  return useMaster("circle_tags", SUGGESTED_TAGS).labels;
}

/** A topic's picture: the one staff set, else the one its name points to. */
export function topicPicture(t: Topic): string {
  return t.pic || masterPicture("circle_topics", { key: t.id, label: t.label, extra: {} });
}

/** A circle's picture: its cover; else its topic's — or its own words, unless staff chose the topic's. */
export function circlePicture(c: { cover?: string | null; name: string; desc?: string }, t: Topic): string {
  return pictureOr(c.cover, [c.name, c.desc], { src: topicPicture(t), staff: !!t.picByStaff });
}
