"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n";
import { Pause, Play } from "lucide-react";

export default function AuthShowcase() {
  const tr = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  const toggle = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="auth-video-wrap">
      <video ref={videoRef} className="auth-video" src="/womsakhi-reveal.mp4" poster="/ux/brand/auth-reveal-poster.png"
        autoPlay muted loop playsInline aria-label={tr("AuthShowcase.theWomsakhiStory")}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button type="button" className="auth-video-toggle" onClick={toggle}
        aria-label={playing ? "Pause story" : "Play story"}>
        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
      </button>
    </div>
  );
}

export function AuthShowcaseCompact() { return null; }
