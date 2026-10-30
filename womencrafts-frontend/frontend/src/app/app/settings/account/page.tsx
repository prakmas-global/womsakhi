"use client";

import { useCallback, useState } from "react";
import { COPY } from "@/components/ux/copy";

import { apiMeProfile, apiUpdateMeProfile, type MeProfile } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";

/** The five things this screen edits. */
type Field = "name" | "phone" | "place" | "born" | "about";

import { useAuth } from "@/context/AuthContext";
import { Avatar, Btn, Pill } from "@/components/ux/kit";
import { Field, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";
import { Group, SaveBar } from "../_parts/Group";
import { useMe } from "@/components/ux/me";
import { useT } from "@/i18n";
import { PhotoSheet } from "@/components/ux/profile/PhotoSheet";
import { UsernameSheet } from "@/components/ux/profile/UsernameSheet";
import * as Icons from "@/components/ux/icons";
import { Picks, Select } from "@/components/ux/kit/form";

/**
 * Chosen, not typed. Date of birth is three dropdowns that write the same
 * "12 Aug 1995" the profile has always stored; the state is a dropdown and
 * only the town is typed, written back as "Town, State".
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 73 }, (_, i) => String(THIS_YEAR - 18 - i));
const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep",
];
/** Lines women most often start with — one tap, then change any word. */
const ABOUT_STARTERS = [
  "I stitch blouses, kurtas and alterations",
  "I cook home food and run a tiffin service",
  "I do mehendi and beauty work at home",
  "I teach children after school",
  "I make handmade crafts and gifts",
  "I am looking for work I can do from home",
];

function splitDob(dob: string) {
  const m = dob.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  return m ? { d: m[1].padStart(2, "0"), m: m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase(), y: m[3] }
           : { d: "", m: "", y: "" };
}
function splitPlace(place: string) {
  const i = place.lastIndexOf(",");
  const state = i >= 0 ? place.slice(i + 1).trim() : "";
  return STATES.includes(state) ? { town: place.slice(0, i).trim(), state } : { town: place.trim(), state: "" };
}

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

  const locked = !!(profile?.name_locked ?? user?.name_locked);
  const username = profile?.username ?? user?.username ?? "";
  const [nameOpen, setNameOpen] = useState(false);
  const nextChange = profile?.username_next_change_at
    ? new Date(profile.username_next_change_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";

  const put = (k: Field, value: string) => { setEdited((f) => ({ ...f, [k]: value })); setSaved(false); };
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => put(k, e.target.value);

  const dob = splitDob(form.born);
  // Keeps a half-picked date in place until all three are chosen.
  const [dobDraft, setDobDraft] = useState<{ d: string; m: string; y: string } | null>(null);
  const shownDob = dobDraft ?? dob;
  const pickDob = (part: "d" | "m" | "y", value: string) => {
    const next = { ...shownDob, [part]: value };
    setDobDraft(next);
    if (next.d && next.m && next.y) put("born", `${next.d} ${next.m} ${next.y}`);
  };
  const place = splitPlace(form.place);
  const putPlace = (town: string, state: string) =>
    put("place", [town.trim(), state].filter(Boolean).join(", "));

  const save = useAction(
    async () => {
      await apiUpdateMeProfile({
        // Empty until our team approves her and enters it from her ID card;
        // the server refuses an empty name, so an empty one is left out.
        // Once she is verified her name is the one on her ID, and only staff
        // change it — so it is not sent at all.
        ...(!locked && form.name.trim() ? { full_name: form.name.trim() } : {}),
        phone: form.phone.trim(),
        location: form.place.trim(),
        dob: form.born.trim(),
        bio: form.about.trim(),
      });
    },
    {
      onDone: () => { setSaved(true); setEdited({}); setDobDraft(null); refetch(); },
      fallbackError: "That did not save. Your details are as they were — try again in a moment.",
    },
  );

  /**
   * Her photograph.
   *
   * "Change" said "Choosing a photo…" and opened nothing; "Remove" said "Photo
   * removed" and removed nothing. Both are real now, and live in the shared
   * photo sheet (take / choose / remove) that the profile screen opens too —
   * which also writes the new photo into the session so the rail card and the
   * top bar change without a reload.
   */
  const [photoOpen, setPhotoOpen] = useState(false);
  const avatar = (user ? user.avatar : profile?.avatar) || "";

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
          <button type="button" onClick={() => setPhotoOpen(true)} aria-haspopup="dialog"
                  aria-label={avatar ? "Change your photo" : "Add a photo"} className="ux-press shrink-0 rounded-full">
            <Avatar src={avatar} name={form.name || ME.name} size={76} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("settingsAccount.yourPhoto")}</p>
            <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
              Shown on your profile, your shop and beside anything you post. A clear face photo gets more
              replies than a logo.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Btn variant="outline" size="sm" icon="Camera" onClick={() => setPhotoOpen(true)}>
                {avatar ? "Change photo" : "Add a photo"}
              </Btn>
            </div>
          </div>
        </div>
      </Group>

      <PhotoSheet open={photoOpen} onClose={() => setPhotoOpen(false)}
                  name={form.name || ME.name} avatar={avatar} onChanged={refetch} />
      <UsernameSheet key={nameOpen ? "open" : "shut"} open={nameOpen} onClose={() => setNameOpen(false)}
                     current={username} fullName={form.name} onSaved={refetch} />

      <Group title={tr("settingsAccount.shownToEveryone")} chip="Public" inset="form">
        <div className="space-y-4">
          {locked ? (
            <Field label={tr("settingsAccount.yourName")}
                   hint="Checked against your ID when you were verified. To correct it, ask WomSakhi from Help.">
              <div className="flex min-h-[46px] items-center gap-2 rounded-[12px] border px-4 text-xsm font-semibold"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}
                   data-name-locked>
                <span className="min-w-0 flex-1 truncate">{form.name}</span>
                <Icons.BadgeCheck className="h-4 w-4 shrink-0" style={{ color: "var(--ux-blue)" }} />
                <Icons.Lock className="h-4 w-4 shrink-0" style={{ color: "var(--ux-muted)" }} />
              </div>
            </Field>
          ) : (
            <Field label={tr("settingsAccount.yourName")} hint={tr("settingsAccount.onYourProfileYourShopAnd")}>
              <TextInput value={form.name} onChange={set("name")} />
            </Field>
          )}
          <Field label="Username"
                 hint={username ? "Other women see this instead of your name. You can change it once every 90 days."
                                : "Until you pick one, other women see your verified name."}>
            <div className="flex min-h-[46px] items-center gap-2 rounded-[12px] border px-4 text-xsm"
                 style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
              <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: username ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                {username ? `@${username}` : "Not picked yet"}
              </span>
              {nextChange ? (
                <span className="shrink-0 text-xs" style={{ color: "var(--ux-muted)" }}>Can change on {nextChange}</span>
              ) : (
                <button type="button" onClick={() => setNameOpen(true)}
                        className="ux-press -me-2 min-h-[36px] shrink-0 rounded-full px-3 text-xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                  {username ? "Change" : "Pick one"}
                </button>
              )}
            </div>
          </Field>
          <Field label={tr("settingsAccount.aLineAboutYou")} hint={tr("settingsAccount.theFirstThingAnEmployerOr")}>
            <TextInput value={form.about} onChange={set("about")} placeholder="Tap a line below, then change any word" />
            <Picks options={ABOUT_STARTERS} value={form.about} onPick={(x) => put("about", x)} label="Lines to start from" />
          </Field>
        </div>
      </Group>

      <Group title={tr("settingsAccount.onlyYouAndWomsakhi")} chip="Private" inset="form"
             noteIcon="Lock" noteGap="mt-4" note={tr("settingsAccount.yourExactAddressIsNeverStored")}>
        <div className="space-y-4">
          <Field label={tr("settingsAccount.phoneNumber")} hint={tr("settingsAccount.neverShownToBuyersOrEmployers")}>
            <TextInput value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" type="tel" inputMode="tel" />
          </Field>
          <Field label={tr("settingsAccount.whereYouLive")} hint={tr("settingsAccount.onlyTheCityIsUsedTo")}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={place.state} onChange={(st) => putPlace(place.town, st)} label="State"
                      placeholder="Choose your state" options={STATES} />
              <TextInput value={place.town} onChange={(e) => putPlace(e.target.value, place.state)}
                         placeholder="Town or city" aria-label="Town or city" />
            </div>
          </Field>
          <Field label={tr("settingsAccount.dateOfBirth")} hint={tr("settingsAccount.someSchemesHaveAnAgeLimit")}>
            <div className="grid grid-cols-[1fr_1.2fr_1.3fr] gap-2">
              <Select value={shownDob.d} onChange={(x) => pickDob("d", x)} label="Day" placeholder="Day" options={DAYS} />
              <Select value={shownDob.m} onChange={(x) => pickDob("m", x)} label="Month" placeholder="Month" options={MONTHS} />
              <Select value={shownDob.y} onChange={(x) => pickDob("y", x)} label="Year" placeholder="Year" options={YEARS} />
            </div>
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

      <Group title="WomSakhi tour" icon="Sparkles"
             note="Revisit any part of the getting-started guide whenever you want.">
        <div className="py-1">
          <p className="text-[13px] leading-relaxed lg:text-xs" style={{ color: "var(--ux-muted)" }}>
            Open the full guide or jump straight to one part of WomSakhi.
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {["Home & Sakhi", "Learn", "Work", "Earn & Money", "Circle", "Health", "Help & Safety"].map((label, index) => (
              <a key={label} href={`/app/welcome?replay=1&step=${index + 1}`} className="ux-press min-h-[44px] shrink-0 rounded-full border px-3.5 py-2.5 text-xs font-semibold" style={{ borderColor: "var(--ux-line)", color: "var(--ux-brand)", background: "var(--ux-surface)" }}>
                {label}
              </a>
            ))}
          </div>
          <Btn href="/app/welcome?replay=1" variant="outline" size="sm" iconEnd="ArrowRight" className={`${phoneSecondary} mt-3`}>
            Start the full tour
          </Btn>
        </div>
      </Group>

      {/*
        Her own copy of herself.

        There was no way for a member to get her data out of this product —
        `/me/export` was a 404, and the only exports were staff reports ABOUT
        members. Under the DPDP Act 2023 a Data Principal has a right of
        access, and more plainly: a woman who is thinking about leaving should
        be able to take her nine months of records with her.

        A plain link, not a fetch-and-blob: the browser downloads it, no
        JavaScript has to hold her whole record in memory, and it still works
        if the page's scripts have failed.
      */}
      <Group title={tr("settingsAccount.yourDataTitle")} icon="Download"
             note={tr("settingsAccount.yourDataNote")}>
        <div className="flex flex-col gap-3 py-1 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <p className="min-w-0 text-[13px] leading-relaxed lg:text-xs" style={{ color: "var(--ux-muted)" }}>
            {tr("settingsAccount.yourDataBody")}
          </p>
          <Btn href="/api/v1/me/export" download="womsakhi-my-data.json"
               variant="outline" size="sm" icon="Download" className={phoneSecondary}>
            {tr("settingsAccount.downloadMyData")}
          </Btn>
        </div>
      </Group>
    </SettingsPage>
  );
}
