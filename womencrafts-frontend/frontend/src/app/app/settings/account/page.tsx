"use client";

import { useCallback, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";

import { apiMeProfile, apiUpdateMeProfile, type MeProfile } from "@/lib/member-api";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";

/** The five things this screen edits. */
type Field = "name" | "phone" | "place" | "born" | "about";

import { useAuth } from "@/context/AuthContext";
import { Btn, Pill } from "@/components/ux/kit";
import { Field, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";
import { Group, SaveBar } from "../_parts/Group";
import { useMe } from "@/components/ux/me";
import { useT } from "@/i18n";

/**
 * Your details.
 *
 * Every field says who can see it. On a platform where a woman's address and
 * phone number could put her at risk, "who else sees this?" is the question she
 * is actually asking of the form, and answering it beside each field is the
 * difference between filling it in and abandoning it.
 */
export default function AccountSettings() {
  const tr = useT();
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
      title={tr("settingsAccount.yourDetails")}
      sub={tr("settingsAccount.onlyWhatIsMarkedPublicIs")}
      footer={
        <SaveBar tone={save.error ? "--ux-orange-ink" : saved ? "--ux-green-ink" : "--ux-faint"}
                 status={save.error ? save.error : saved ? "Saved." : COPY.nothingSavedYet}>
          <Btn variant="primary" icon={save.busy ? "Loader" : "Check"} disabled={save.busy}
               className={phonePrimary} onClick={() => void save.run()}>
            {save.busy ? "Saving…" : "Save changes"}
          </Btn>
        </SaveBar>
      }
    >
      <Group inset="form">
        <div className="flex items-center gap-4">
          <span className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full"
                style={{ background: "var(--ux-brand-tint)" }}>
            {/* Hers, from her profile — not the fixture face, which is what
                every woman saw here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={profile?.avatar || ME.avatar} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("settingsAccount.yourPhoto")}</p>
            <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
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
              <p role="alert" className="ux-slide-up mt-2 text-xs leading-snug"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {photoError || removePhoto.error}
              </p>
            )}
          </div>
        </div>
      </Group>

      <Group title={tr("settingsAccount.shownToEveryone")} chip="Public" inset="form">
        <div className="space-y-4">
          <Field label={tr("settingsAccount.yourName")} hint={tr("settingsAccount.onYourProfileYourShopAnd")}>
            <TextInput value={form.name} onChange={set("name")} />
          </Field>
          <Field label={tr("settingsAccount.aLineAboutYou")} hint={tr("settingsAccount.theFirstThingAnEmployerOr")}>
            <TextInput value={form.about} onChange={set("about")} />
          </Field>
        </div>
      </Group>

      <Group title={tr("settingsAccount.onlyYouAndWomsakhi")} chip="Private" inset="form"
             noteIcon="Lock" noteGap="mt-4" note={tr("settingsAccount.yourExactAddressIsNeverStored")}>
        <div className="space-y-4">
          <Field label={tr("settingsAccount.phoneNumber")} hint={tr("settingsAccount.neverShownToBuyersOrEmployers")}>
            <TextInput value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
          </Field>
          <Field label={tr("settingsAccount.whereYouLive")} hint={tr("settingsAccount.onlyTheCityIsUsedTo")}>
            <TextInput value={form.place} onChange={set("place")} placeholder={tr("settingsAccount.cityState")} />
          </Field>
          <Field label={tr("settingsAccount.dateOfBirth")} hint={tr("settingsAccount.someSchemesHaveAnAgeLimit")}>
            <TextInput value={form.born} onChange={set("born")} placeholder="DD MMM YYYY" />
          </Field>
        </div>
      </Group>

      <Group title={tr("settingsAccount.signInEmail")} inset="form">
        {/* On a phone the button takes its own full-width row under the
            address; beside it, it squeezed the address to a sliver. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="min-w-0">
            {/*
              The address truncates; the badge never does.

              As one `truncate` line the two shared a single clipped box, and an
              ordinary address filled it — so "Confirmed" began 6px PAST the
              hard edge and all 93px of it was invisible. The one word telling
              her whether her account actually works was the part that got cut.
              Wrapping lets it drop to a second line on a phone instead.
            */}
            <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium" style={{ color: "var(--ux-ink)" }}>
              <span className="min-w-0 max-w-full truncate">{profile?.email ?? user?.email ?? ""}</span>
              {/* The green "Confirmed" was painted whatever the server said. */}
              {profile?.verification_status === "active"
                ? <Pill tone="green" size="sm">Confirmed</Pill>
                : <Pill tone="orange" size="sm">{tr("settingsAccount.notConfirmedYet")}</Pill>}
            </p>
            <p className="mt-1 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>{tr("settingsAccount.youCannotChangeThisYourselfAsk")}</p>
          </div>
          {/* "Check both inboxes" was a lie about two emails nobody sent:
              nothing in this API changes a sign-in address — /users/me takes
              only a name and a locale. So it says who can do it instead. */}
          <Btn href="/app/help" variant="outline" size="sm" iconEnd="ArrowRight" className={phoneSecondary}>{tr("settingsAccount.askUsToChangeIt")}</Btn>
        </div>
      </Group>
    </SettingsPage>
  );
}
