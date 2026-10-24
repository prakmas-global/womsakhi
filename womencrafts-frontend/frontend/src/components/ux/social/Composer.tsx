"use client";

import { useRef, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Avatar, Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiUploadImage } from "@/lib/uploads-api";
import { apiCreatePost, type Audience, type FeedPost } from "@/lib/social-api";

/**
 * Write a post. Most women start from a chip — "Ask a question", "Share a
 * win" — which puts the first words in for her. Who sees it is one dropdown,
 * "Only my friends" until she says otherwise.
 */
const STARTERS: { label: string; icon: string; text: string }[] = [
  { label: "Ask a question", icon: "HelpCircle", text: "Has anyone tried this? I would love your advice: " },
  { label: "Share a win", icon: "Trophy", text: "Happy news! Today I " },
  { label: "Need help with…", icon: "HandHeart", text: "I need help with " },
  { label: "Share a tip", icon: "Lightbulb", text: "A tip that worked for me: " },
  { label: "Thank someone", icon: "Heart", text: "A big thank you to " },
];

export function Composer({ name, greet, avatar, onPosted }: {
  name: string;
  /** Her own first name for the greeting — not the username. */
  greet: string;
  avatar: string;
  onPosted: (p: FeedPost) => void;
}) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [audience, setAudience] = useState<Audience>("friends");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const start = (t: string) => {
    setText(t);
    window.setTimeout(() => { area.current?.focus(); area.current?.setSelectionRange(t.length, t.length); }, 0);
  };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 4 - photos.length;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const up = await apiUploadImage(f, "attachment");
        setPhotos((p) => [...p, { path: up.url, url: up.url }]);
      }
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };

  const post = async () => {
    setBusy(true);
    try {
      const p = await apiCreatePost({ text: text.trim(), photos: photos.map((x) => x.path), audience });
      setText(""); setPhotos([]);
      onPosted(p);
      toast(audience === "everyone" ? "Posted for everyone" : "Posted for your friends", { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const ready = (text.trim() || photos.length) && !uploading;
  const first = greet.split(" ")[0] || "there";

  return (
    <section className="ux-card" style={{ padding: 16 }} aria-label="Write a post" data-composer>
      <div className="flex items-start gap-3">
        <Avatar src={avatar} name={name} size={44} />
        <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
                  rows={text ? 3 : 2} aria-label="What would you like to share?"
                  placeholder={`What would you like to share, ${first}?`}
                  className="min-h-[52px] w-full resize-none rounded-[14px] px-3.5 py-3 text-[15px] outline-none lg:text-sm"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }} />
      </div>

      {!text && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STARTERS.map((s) => {
            const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[s.icon] ?? Icons.Sparkles;
            return (
              <button key={s.label} type="button" onClick={() => start(s.text)}
                      className="ux-press inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                <I className="h-3.5 w-3.5" />{s.label}
              </button>
            );
          })}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative aspect-square overflow-hidden rounded-[10px]" style={{ background: "var(--ux-surface-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((y) => y.path !== p.path))}
                      className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full"
                      style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                <Icons.X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
        <button type="button" disabled={photos.length >= 4 || uploading} onClick={() => file.current?.click()}
                className="ux-press ux-hov inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] px-2.5 text-xsm font-semibold disabled:opacity-40"
                style={{ color: "var(--ux-green-ink)" }}>
          {uploading ? <Icons.Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Icons.ImagePlus className="h-[18px] w-[18px]" />}
          <span className="max-sm:sr-only">Photo</span>{photos.length ? ` ${photos.length}/4` : ""}
        </button>
        {/* The app's own select (border, chevron); the icon says who at a glance. */}
        <label className="inline-flex items-center gap-1.5 text-xsm font-semibold" style={{ color: "var(--ux-ink-2)" }}>
          {audience === "everyone" ? <Icons.Globe className="h-4 w-4 max-sm:hidden" /> : <Icons.Users className="h-4 w-4 max-sm:hidden" />}
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} aria-label="Who can see this"
                  style={{ minHeight: 40 }}>
            <option value="friends">Only my friends</option>
            <option value="everyone">Everyone</option>
          </select>
        </label>
        <div className="ms-auto">
          <Btn icon="Send" disabled={!ready} loading={busy} onClick={post}>Post</Btn>
        </div>
      </div>
    </section>
  );
}
