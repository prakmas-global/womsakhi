"use client";

import { useCallback, useRef, useState } from "react";

import { apiMeProfile, apiUpdateMeProfile, type MeProfile } from "@/lib/member-api";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";

/** The five things this screen edits. */
type Field = "name" | "phone" | "place" | "born" | "about";
import * as Icons from "@/components/ux/icons";

import { useAuth } from "@/context/AuthContext";
import { Btn, Pill } from "@/components/ux/kit";
import { Card, Field, SectionHead, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { useMe } from "@/components/ux/me";

/**
 * Your details.
 *
 * Every field says who can see it. On a platform where a woman's address and
 * phone number could put her at risk, "who else sees this?" is the question she
 * is actually asking of the form, and answering it beside each field is the
 * difference between filling it in and abandoning it.
 */
export default function AccountSettings() {
  const ME = useMe();
  const { user } = useAuth();
  /**
   * Her details, from her profile.
   *
   * Four of these five fields were hardcoded — a phone number, "Jaipur,
   * Rajasthan", a date of birth and a sentence about sewing — and shown to
   * every woman as her own. She is in Mumbai. Pressing "Save changes" set a
   * flag, so at least none of it was written back; wiring the button without
   * fixing the source would have written a stranger's details over hers.
   */
  const { data: profile, refetch } = useResource(
    useCallback(() => apiMeProfile(), []),
    null as MeProfile | null,
  );
  const [edited, setEdited] = useState<Partial<Record<Field, string>>>({});
  const [saved, setSaved] = useState(false);

  const form = {
    name: edited.name ?? profile?.full_name ?? user?.full_name ?? ME.name,
    phone: edited.phone ?? profile?.phone ?? "",
    place: edited.place ?? profile?.location ?? "",
    born: edited.born ?? profile?.dob ?? "",
    about: edited.about ?? profile?.bio ?? "",
  };

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setEdited((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const save = useAction(
    async () => {
      await apiUpdateMeProfile({
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.place.trim(),
        dob: form.born.trim(),
        bio: form.about.trim(),
      });
    },
    {
      onDone: () => { setSaved(true); setEdited({}); refetch(); },
      fallbackError: "That did not save. Your details are as they were — try again in a moment.",
    },
  );

  /**
   * Her photograph.
   *
   * "Change" said "Choosing a photo…" and opened nothing; "Remove" said "Photo
   * removed" and removed nothing — she came back to the same picture with no
   * idea why. Both are real now: the file goes to POST /uploads and the URL it
   * returns is written to her profile, and removing clears the same field.
   */
  const file = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState("");
  const [photoError, setPhotoError] = useState("");

  async function choosePhoto(chosen: File | undefined) {
    if (!chosen) return;
    setPhotoError("");
    // Said before the upload, not after it. A woman on a metered connection
    // should not pay in data for a refusal we could see coming.
    const no = validateImage(chosen);
    if (no) { setPhotoError(no); return; }
    setPhotoBusy("Uploading…");
    try {
      const up = await apiUploadImage(chosen, "avatar");
      await apiUpdateMeProfile({ avatar: up.url });
      refetch();
    } catch (e) {
      setPhotoError(uploadErrorMessage(e));
    } finally {
      setPhotoBusy("");
    }
  }

  const removePhoto = useAction(
    async () => { await apiUpdateMeProfile({ avatar: "" }); },
    { onDone: refetch, fallbackError: "That did not go through. Your photo is as it was." },
  );

  return (
    <SettingsPage
      title="Your details"
      sub="Only what is marked public is ever shown to anyone else."
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.75rem]"
             style={{ color: save.error ? "var(--ux-orange-ink)" : saved ? "var(--ux-green-ink)" : "var(--ux-faint)" }}>
            {save.error ? save.error : saved ? "Saved." : "Nothing is saved until you press the button."}
          </p>
          <Btn variant="primary" icon={save.busy ? "Loader" : "Check"} disabled={save.busy}
               onClick={() => void save.run()}>
            {save.busy ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      }
    >
      <Card>
        <div className="flex items-center gap-4">
          <span className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full"
                style={{ background: "var(--ux-brand-tint)" }}>
            {/* Hers, from her profile — not the fixture face, which is what
                every woman saw here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={profile?.avatar || ME.avatar} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>Your photo</p>
            <p className="mt-1 text-[0.75rem] leading-snug" style={{ color: "var(--ux-muted)" }}>
              Shown on your profile, your shop and beside anything you post. A clear face photo gets more
              replies than a logo.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input ref={file} type="file" accept="image/*" className="hidden"
                     aria-hidden tabIndex={-1}
                     onChange={(e) => { void choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <Btn variant="outline" size="sm" icon={photoBusy ? "Loader" : "Upload"}
                   disabled={!!photoBusy} onClick={() => file.current?.click()}>
                {photoBusy || "Change"}
              </Btn>
              {(profile?.avatar || "") !== "" && (
                <Btn variant="ghost" size="sm" disabled={removePhoto.busy}
                     onClick={() => void removePhoto.run()}>
                  {removePhoto.busy ? "Removing…" : "Remove"}
                </Btn>
              )}
            </div>
            {(photoError || removePhoto.error) && (
              <p role="alert" className="ux-slide-up mt-2 text-[0.75rem] leading-snug"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {photoError || removePhoto.error}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead title="Shown to everyone" chip="Public" />
        <div className="space-y-4">
          <Field label="Your name" hint="On your profile, your shop and every message you send.">
            <TextInput value={form.name} onChange={set("name")} />
          </Field>
          <Field label="A line about you" hint="The first thing an employer or buyer reads.">
            <TextInput value={form.about} onChange={set("about")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead title="Only you and WomSakhi" chip="Private" />
        <div className="space-y-4">
          <Field label="Phone number" hint="Never shown to buyers or employers. We use it for alerts only.">
            <TextInput value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
          </Field>
          <Field label="Where you live" hint="Only the city is used, to find work and events near you.">
            <TextInput value={form.place} onChange={set("place")} placeholder="City, State" />
          </Field>
          <Field label="Date of birth" hint="Some schemes have an age limit. Never shown anywhere.">
            <TextInput value={form.born} onChange={set("born")} placeholder="DD MMM YYYY" />
          </Field>
        </div>
        <p className="mt-4 flex items-start gap-2.5 rounded-[12px] p-3 text-[0.75rem] leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.Lock className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          Your exact address is never stored. Buyers see a city, never a street.
        </p>
      </Card>

      <Card>
        <SectionHead title="Sign-in email" />
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-[0.875rem] font-medium" style={{ color: "var(--ux-ink)" }}>
              {profile?.email ?? user?.email ?? ""}
              {/* The green "Confirmed" was painted whatever the server said. */}
              {profile?.verification_status === "active"
                ? <Pill tone="green" size="sm">Confirmed</Pill>
                : <Pill tone="orange" size="sm">Not confirmed yet</Pill>}
            </p>
            <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
              You cannot change this yourself — ask us and we will do it.
            </p>
          </div>
          {/* "Check both inboxes" was a lie about two emails nobody sent:
              nothing in this API changes a sign-in address — /users/me takes
              only a name and a locale. So it says who can do it instead. */}
          <Btn href="/app/help" variant="outline" size="sm" iconEnd="ArrowRight">Ask us to change it</Btn>
        </div>
      </Card>
    </SettingsPage>
  );
}
