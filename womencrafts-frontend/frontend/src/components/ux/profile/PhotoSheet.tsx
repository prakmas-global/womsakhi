"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import * as Icons from "@/components/ux/icons";
import { Avatar } from "@/components/ux/kit";
import { useSetMyAvatar } from "@/components/ux/me";
import { useShell } from "@/components/ux/ShellProvider";
import { useToast } from "@/design-system";
import { apiUpdateMeProfile } from "@/lib/member-api";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";
import { useDialogBehaviour } from "@/lib/use-dialog";

const NEVER_CHANGES = () => () => {};

/**
 * Change her photograph: take one, pick one, or go back to her initials.
 *
 * A bottom sheet on a phone, a small dialog from 640px up. Both paths end in
 * the same place: the upload goes to POST /uploads, the URL is written to her
 * profile, and `useSetMyAvatar` puts it into the session so the rail card and
 * the top-bar avatar change without a reload.
 *
 * Portalled to the shell's `.ux` element, not to `document.body` — the colour
 * tokens are declared on `.ux`, so a panel under `<body>` renders unstyled.
 *
 * The two file inputs stay mounted while the sheet is closed so a picker that
 * returns after the panel re-renders still has somewhere to deliver the file.
 */
export function PhotoSheet({
  open,
  onClose,
  name,
  avatar,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** For the initials preview and the accessible name. */
  name: string;
  /** Her current photo URL; empty when she has none. */
  avatar: string;
  /** After the server has accepted a new photo (or its removal). */
  onChanged?: (avatar: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const setMyAvatar = useSetMyAvatar();
  // The rail's "x% completed" counts the photo too.
  const shell = useShell();
  const toast = useToast();
  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);

  const [busy, setBusy] = useState<"" | "upload" | "remove">("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");

  // A fresh start each time it opens; an error from last time is not news.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => { setError(""); setPct(0); });
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape and the dim must not abandon an upload half-way; they close it
  // once it has finished.
  useDialogBehaviour(open, panelRef, () => { if (!busy) onClose(); });

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    const no = validateImage(file);
    if (no) { setError(no); return; }
    setBusy("upload");
    setPct(0);
    try {
      const up = await apiUploadImage(file, "avatar", setPct);
      await apiUpdateMeProfile({ avatar: up.url });
      setMyAvatar(up.url);
      onChanged?.(up.url);
      shell.refresh();
      toast.success("Photo updated", { description: "Your new photo is on your profile." });
      onClose();
    } catch (e) {
      setError(uploadErrorMessage(e));
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setError("");
    setBusy("remove");
    try {
      await apiUpdateMeProfile({ avatar: "" });
      setMyAvatar("");
      onChanged?.("");
      shell.refresh();
      toast.success("Photo removed", { description: "Your initials are shown instead." });
      onClose();
    } catch {
      setError("That did not go through. Your photo is as it was.");
    } finally {
      setBusy("");
    }
  }

  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden"
             aria-hidden tabIndex={-1} data-photo-input="camera"
             onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden"
             aria-hidden tabIndex={-1} data-photo-input="gallery"
             onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (!onClient) return null;
  const host = document.querySelector(".ux") ?? document.body;

  const hasPhoto = !!avatar.trim();
  const row = "ux-press ux-hov flex min-h-[52px] w-full items-center gap-3.5 rounded-[14px] px-3 text-start text-sm font-semibold transition-colors hover:bg-[var(--ux-surface-2)] disabled:opacity-50";
  const tile = "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]";

  return createPortal(
    <>
      {inputs}
      {open && <div className="fixed inset-0 z-[var(--ux-z-modal)] flex items-end justify-center sm:items-center sm:p-6">
        <button type="button" aria-label="Close" tabIndex={-1}
                onClick={() => { if (!busy) onClose(); }}
                className="absolute inset-0"
                style={{ background: "color-mix(in srgb, var(--ux-ink) 32%, transparent)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={!!busy}
          tabIndex={-1}
          data-photo-sheet
          className="ux-sheet relative w-full rounded-t-[22px] px-4 pt-2 sm:max-w-[380px] sm:rounded-[20px] sm:pt-4"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
        >
          <span aria-hidden className="mx-auto mb-3 block h-[4px] w-[44px] rounded-full sm:hidden"
                style={{ background: "var(--ux-line-strong)" }} />
          <div className="mb-3 flex items-center gap-3 px-1">
            <Avatar src={avatar} name={name} size={44} />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>Profile photo</h2>
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
                {hasPhoto ? "Shown on your profile and beside what you post." : "You are showing your initials."}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" disabled={!!busy}
                    className="ux-press ux-sq grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                    style={{ color: "var(--ux-muted)" }}>
              <Icons.X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="space-y-1">
            <button type="button" className={row} style={{ color: "var(--ux-ink)" }}
                    disabled={!!busy} onClick={() => camera.current?.click()}>
              <span className={tile} style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                <Icons.Camera className="h-[18px] w-[18px]" />
              </span>
              Take photo
            </button>
            <button type="button" className={row} style={{ color: "var(--ux-ink)" }}
                    disabled={!!busy} onClick={() => gallery.current?.click()}>
              <span className={tile} style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet)" }}>
                <Icons.Image className="h-[18px] w-[18px]" />
              </span>
              Choose from gallery
            </button>
            {hasPhoto ? (
              <button type="button" className={row} style={{ color: "var(--ux-pink-ink)" }}
                      disabled={!!busy} onClick={() => void remove()}>
                <span className={tile} style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }}>
                  <Icons.Trash2 className="h-[18px] w-[18px]" />
                </span>
                {busy === "remove" ? "Removing…" : "Remove photo"}
              </button>
            ) : (
              <div className="flex min-h-[52px] items-center gap-3.5 px-3 text-sm font-semibold" style={{ color: "var(--ux-muted)" }}>
                <span className={tile} style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
                  <Icons.User className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">Use my initials</span>
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--ux-green-ink)" }}>
                  <Icons.Check className="h-3.5 w-3.5" strokeWidth={3} /> Current
                </span>
              </div>
            )}
          </div>

          {busy === "upload" && (
            <div className="mt-3 px-1" role="status" aria-live="polite">
              <p className="mb-1.5 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--ux-ink-2)" }}>
                <Icons.Loader className="h-3.5 w-3.5 animate-spin" /> Uploading… {pct ? `${pct}%` : ""}
              </p>
              <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track, var(--ux-surface-2))" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(8, pct)}%`, background: "var(--ux-fill)",
                                                                transition: "width var(--ux-t) var(--ux-ease)" }} />
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 px-1 text-xs leading-snug" style={{ color: "var(--ux-orange-ink)" }}>{error}</p>
          )}
        </div>
      </div>}
    </>,
    host,
  );
}
