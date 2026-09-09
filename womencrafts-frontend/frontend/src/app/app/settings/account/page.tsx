"use client";

import { useCallback, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";

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
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs"
             style={{ color: save.error ? "var(--ux-orange-ink)" : saved ? "var(--ux-green-ink)" : "var(--ux-faint)" }}>
            {save.error ? save.error : saved ? "Saved." : COPY.nothingSavedYet}
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
            <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("settingsAccount.yourPhoto")}</p>
            <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
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
      </Card>

      <Card>
        <SectionHead title={tr("settingsAccount.shownToEveryone")} chip="Public" />
        <div className="space-y-4">
          <Field label={tr("settingsAccount.yourName")} hint={tr("settingsAccount.onYourProfileYourShopAnd")}>
            <TextInput value={form.name} onChange={set("name")} />
          </Field>
          <Field label={tr("settingsAccount.aLineAboutYou")} hint={tr("settingsAccount.theFirstThingAnEmployerOr")}>
            <TextInput value={form.about} onChange={set("about")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead title={tr("settingsAccount.onlyYouAndWomsakhi")} chip="Private" />
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
        <p className="mt-4 flex items-start gap-2.5 rounded-[12px] p-3 text-xs leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.Lock className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />{tr("settingsAccount.yourExactAddressIsNeverStored")}</p>
      </Card>

      <Card>
        <SectionHead title={tr("settingsAccount.signInEmail")} />
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-medium" style={{ color: "var(--ux-ink)" }}>
              {profile?.email ?? user?.email ?? ""}
              {/* The green "Confirmed" was painted whatever the server said. */}
              {profile?.verification_status === "active"
                ? <Pill tone="green" size="sm">Confirmed</Pill>
                : <Pill tone="orange" size="sm">{tr("settingsAccount.notConfirmedYet")}</Pill>}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>{tr("settingsAccount.youCannotChangeThisYourselfAsk")}</p>
          </div>
          {/* "Check both inboxes" was a lie about two emails nobody sent:
              nothing in this API changes a sign-in address — /users/me takes
              only a name and a locale. So it says who can do it instead. */}
          <Btn href="/app/help" variant="outline" size="sm" iconEnd="ArrowRight">{tr("settingsAccount.askUsToChangeIt")}</Btn>
        </div>
      </Card>
    </SettingsPage>
  );
}
