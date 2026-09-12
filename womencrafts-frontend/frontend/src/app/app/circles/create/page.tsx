"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, I, IconTile, v } from "@/components/ux/kit";
import { Area, Choice, Label, Select, Steps, Text, Toggle } from "@/components/ux/kit/form";
import { apiCreateCircle } from "@/lib/growth-api";
import { apiUploadImage } from "@/lib/uploads-api";
import { settled, useAttemptKey } from "@/lib/idempotency";
import { PRIVACY, SUGGESTED_TAGS, TOPICS } from "@/components/ux/circle/data";
import {
  Block, CircleTips, CoverPicker, CreateHero, LivePreview, PartlySaved, SafePromise, TagField,
} from "./create-views";

/**
 * Start a circle.
 *
 * ── What reaches the server ─────────────────────────────────────────────────
 * `POST /community/circles` takes a name, a topic and a description, and those
 * are written. It has no column for privacy, a cover, an icon, tags, who may
 * post, or an invite list — so those are collected, shown in the preview, and
 * marked with `SourceNote` on the steps that gather them. Nothing here claims
 * a setting was saved that was not.
 *
 * ── Not a savings circle ────────────────────────────────────────────────────
 * `is_savings: false`, deliberately and always. A savings circle is a
 * financial commitment between women and is started at `/app/circles/new`,
 * which asks the questions money requires. This screen makes a room to talk
 * in, and the two must never be one form.
 *
 * ── Why the preview is beside her, not behind a button ──────────────────────
 * She is describing a place to strangers. Every field she fills changes what
 * one of them sees, and she cannot judge "is this a circle I would join?"
 * from a form.
 */

const STEPS = [
  { id: 1, label: "Circle details" },
  { id: 2, label: "Settings" },
  { id: 3, label: "Invite members" },
  { id: 4, label: "Review and create" },
] as const;

const WHO_POSTS = [
  { id: "all",   icon: "Users",        title: "Anyone in the circle", sub: "Every member can start a discussion." },
  { id: "hosts", icon: "ShieldCheck",  title: "Only you and hosts",   sub: "Members can reply, but not start one." },
];

export default function CreateCirclePage() {
  const router = useRouter();
  const attempt = useAttemptKey("create-circle");

  const [at, setAt] = useState(1);
  const [done, setDone] = useState(1);

  // Step 1
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [cover, setCover] = useState("");
  const [icon, setIcon] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");

  // Step 2
  const [whoPosts, setWhoPosts] = useState("all");
  const [guidelines, setGuidelines] = useState("");
  const [reviewFirst, setReviewFirst] = useState(false);
  const [tellMe, setTellMe] = useState(true);

  // Step 3
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1Ok = name.trim().length > 2 && desc.trim().length > 9 && Boolean(category);

  const go = useCallback((n: number) => {
    setAt(n);
    setDone((d) => Math.max(d, n));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const addTag = useCallback((raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    setTags((p) => (p.includes(t) || p.length >= 5 ? p : [...p, t]));
    setTagDraft("");
  }, []);

  const upload = useCallback(async (f: File, set: (url: string) => void) => {
    setError(null);
    try { const up = await apiUploadImage(f, "attachment"); set(up.url); }
    catch { setError("That image did not upload. Try again in a moment."); }
  }, []);

  /**
   * Write the circle, then open it.
   *
   * Idempotent by attempt key: a lost reply on a slow connection must not
   * leave her with two identical circles and two sets of members.
   */
  const create = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const made = await apiCreateCircle({
        name: name.trim(),
        topic: category,
        desc: desc.trim(),
        is_savings: false,
        monthly_minor: 0,
      }, attempt.current());
      // The server answered: the next press is a new circle, not a retry.
      attempt.settle();
      router.push(made?.id ? `/app/circles/${made.id}` : "/app/circles");
    } catch (e) {
      // Only burn the key if the server actually replied. A dropped
      // connection may still have created the circle, and retrying with a
      // fresh key would make a second one.
      if (settled(e)) attempt.settle();
      setError("That did not save. Nothing you typed is lost — try again in a moment.");
      setSaving(false);
    }
  }, [name, category, desc, attempt, router]);

  const rail = (
    <div className="space-y-4">
      <LivePreview name={name} desc={desc} cover={cover} icon={icon}
                   category={category} privacy={privacy} tags={tags} count={1 + invites.length} />
      <CircleTips at={at} />
      <SafePromise />
    </div>
  );

  return (
    <HomeShell active="/app/circles" rail={rail} bare loadFailed="the circle">
      <div className="flex flex-col">
        <Back to="/app/circles" label="Circle" />
        <CreateHero />

        <Steps steps={STEPS} at={at} done={done} onGo={go} />

        {error && (
          <p role="alert" className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            {error}
          </p>
        )}

        {/* ── 1 · Circle details ──────────────────────────────────────────── */}
        {at === 1 && (
          <Block icon="UsersRound" title="Basic information"
                 sub="What it is called, who it is for, and what it looks like.">
            <div className="mb-5">
              <Label need>What is this circle called</Label>
              <Text value={name} onChange={setName} max={50} label="Circle name"
                    placeholder="e.g. Handmade Business Hub" />
              <span className="mt-1 block text-end text-[12px] lg:text-2xs" style={{ color: v("--ux-faint") }}>
                {name.length}/50
              </span>
            </div>

            <div className="mb-5">
              <Label need>What happens in it</Label>
              <Area value={desc} onChange={setDesc} max={200} rows={3} label="Short description"
                    placeholder="Briefly: who it is for, and what a member can expect." />
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label need>What it is about</Label>
                <Select value={category} onChange={setCategory} label="Category"
                        placeholder="Pick a topic"
                        options={TOPICS.map((t) => t.label)} />
              </div>
              <div>
                <Label need>Who can come in</Label>
                <Select value={privacy} onChange={setPrivacy} label="Privacy"
                        options={PRIVACY.map((p) => ({ value: p.id, label: p.label }))} />
                <span className="mt-1.5 block text-[12px] lg:text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
                  {PRIVACY.find((p) => p.id === privacy)?.note}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <Label>Cover image</Label>
              <CoverPicker cover={cover} onPick={setCover} onUpload={(f) => upload(f, setCover)} />
            </div>

            <div className="mb-5 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
              <div>
                <Label>Circle picture</Label>
                <div className="flex items-center gap-3">
                  <label className="ux-press ux-sq grid h-[64px] w-[64px] cursor-pointer place-items-center overflow-hidden rounded-full"
                         style={{ background: v("--ux-brand-tint"), border: `1px dashed ${v("--ux-brand")}` }}>
                    <input type="file" accept="image/*" className="sr-only" aria-label="Upload a circle picture"
                           onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, setIcon); }} />
                    {icon
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={icon} alt="" aria-hidden className="h-full w-full object-cover" />
                      : <Icons.Camera className="h-[20px] w-[20px]" style={{ color: v("--ux-brand") }} />}
                  </label>
                  <span className="text-[12px] lg:text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
                    A square picture,<br />at least 300 × 300.
                  </span>
                </div>
              </div>
              <div>
                <Label hint="(optional)">Tags</Label>
                <TagField tags={tags} draft={tagDraft} suggestions={SUGGESTED_TAGS}
                          onDraft={setTagDraft} onAdd={addTag}
                          onRemove={(t) => setTags((p) => p.filter((x) => x !== t))} />
              </div>
            </div>

            <PartlySaved notYet="the cover, the circle picture and the tags" />

            <Foot back={<Btn variant="ghost" href="/app/circles">Cancel</Btn>}
                  next={<Btn disabled={!step1Ok} iconEnd="ArrowRight" onClick={() => go(2)}>
                          Next: settings
                        </Btn>} />
          </Block>
        )}

        {/* ── 2 · Settings ────────────────────────────────────────────────── */}
        {at === 2 && (
          <Block icon="Settings" title="How it is run"
                 sub="You can change any of this later, from inside the circle.">
            <div className="mb-5">
              <Label>Who can start a discussion</Label>
              <div className="mt-1 flex flex-col gap-2.5 sm:flex-row">
                {WHO_POSTS.map((w) => (
                  <Choice key={w.id} icon={w.icon} title={w.title} sub={w.sub}
                          on={whoPosts === w.id} onClick={() => setWhoPosts(w.id)} />
                ))}
              </div>
            </div>

            <div className="mb-5">
              <Label hint="(optional)">The one rule you want everyone to read</Label>
              <Area value={guidelines} onChange={setGuidelines} max={300} rows={3} label="Circle guidelines"
                    placeholder="e.g. Ask anything. Nobody here is an expert at everything, and no question is too small." />
            </div>

            <div className="mb-5 space-y-4">
              <Toggle on={reviewFirst} onChange={setReviewFirst}
                      label="Read posts before they appear"
                      sub="Slower, but nothing unkind is ever seen by the circle. Good for a circle about money or health." />
              <Toggle on={tellMe} onChange={setTellMe}
                      label="Tell me when somebody posts"
                      sub="A notification, not an email." />
            </div>

            <PartlySaved notYet="who may post, your one rule, and the two switches above" />

            <Foot back={<Btn variant="ghost" icon="ArrowLeft" onClick={() => go(1)}>Back</Btn>}
                  next={<Btn iconEnd="ArrowRight" onClick={() => go(3)}>Next: invite members</Btn>} />
          </Block>
        )}

        {/* ── 3 · Invite members ──────────────────────────────────────────── */}
        {at === 3 && (
          <Block icon="UserPlus" title="Who should be in it"
                 sub="A circle with three women in it feels alive. One with none feels closed.">
            <div className="mb-4">
              <Label hint="(optional)">Invite by phone number or name</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[220px] flex-1">
                  <Text value={inviteDraft} onChange={setInviteDraft} label="Invite somebody"
                        placeholder="Meera, or 98765 43210" />
                </span>
                <Btn variant="outline" icon="Plus" disabled={!inviteDraft.trim()}
                     onClick={() => {
                       const who = inviteDraft.trim();
                       if (who) setInvites((p) => (p.includes(who) ? p : [...p, who]));
                       setInviteDraft("");
                     }}>
                  Add
                </Btn>
              </div>
            </div>

            {invites.length > 0 && (
              <ul className="mb-5 space-y-2">
                {invites.map((w) => (
                  <li key={w} className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5"
                      style={{ border: "1px solid var(--ux-line)" }}>
                    <IconTile icon="UserRound" tint="--ux-brand-tint-2" ink="--ux-brand" size={30} radius={9} />
                    <span className="min-w-0 flex-1 truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                      {w}
                    </span>
                    <button type="button" aria-label={`Remove ${w}`}
                            onClick={() => setInvites((p) => p.filter((x) => x !== w))}
                            className="ux-press ux-sq grid h-[30px] w-[30px] place-items-center rounded-[8px]"
                            style={{ color: v("--ux-muted") }}>
                      <Icons.X className="h-[14px] w-[14px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-5 flex items-start gap-2.5 rounded-[12px] p-3.5"
                 style={{ background: v("--ux-brand-tint") }}>
              <I name="Link2" className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-brand") }} />
              <span className="min-w-0">
                <span className="block text-xs font-bold" style={{ color: v("--ux-brand") }}>
                  Or just send the link
                </span>
                <span className="mt-0.5 block text-[12px] lg:text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  Once the circle exists you get a link you can put in any WhatsApp group. Most
                  first members arrive that way.
                </span>
              </span>
            </div>

            <PartlySaved notYet="the invitations — nobody is contacted from this screen" />

            <Foot back={<Btn variant="ghost" icon="ArrowLeft" onClick={() => go(2)}>Back</Btn>}
                  next={<Btn iconEnd="ArrowRight" onClick={() => go(4)}>Next: check it over</Btn>} />
          </Block>
        )}

        {/* ── 4 · Review and create ───────────────────────────────────────── */}
        {at === 4 && (
          <Block icon="CheckCircle2" title="Check it over"
                 sub="Everything here can be changed afterwards, except who started it.">
            <dl className="mb-5 divide-y" style={{ borderColor: v("--ux-line") }}>
              {[
                ["Called", name.trim() || "—"],
                ["About", desc.trim() || "—"],
                ["Topic", category || "—"],
                ["Who can come in", PRIVACY.find((p) => p.id === privacy)?.label ?? "—"],
                ["Who can start a discussion", WHO_POSTS.find((w) => w.id === whoPosts)?.title ?? "—"],
                ["Tags", tags.length ? tags.map((t) => `#${t}`).join("  ") : "None"],
                ["Invitations ready", invites.length ? `${invites.length}` : "None yet"],
              ].map(([k, val]) => (
                <div key={k} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                  <dt className="w-[200px] shrink-0 text-[12px] lg:text-2xs font-semibold" style={{ color: v("--ux-muted") }}>{k}</dt>
                  <dd className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink") }}>{val}</dd>
                </div>
              ))}
            </dl>

            <div className="mb-5 flex items-start gap-2.5 rounded-[12px] p-3.5"
                 style={{ background: v("--ux-surface-2") }}>
              <I name="ShieldCheck" className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} />
              <span className="text-[12px] lg:text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                You are the host. You can hand that to somebody else, and you can close the circle —
                but you cannot take back what other women have written in it.
              </span>
            </div>

            <PartlySaved notYet="the cover, picture, tags, settings and invitations" />

            <Foot back={<Btn variant="ghost" icon="ArrowLeft" onClick={() => go(3)}>Back</Btn>}
                  next={<Btn icon="Sparkles" disabled={!step1Ok || saving} loading={saving} onClick={create}>
                          Create this circle
                        </Btn>} />
          </Block>
        )}
      </div>
    </HomeShell>
  );
}

/** The row every step ends with. */
function Foot({ back, next }: { back: React.ReactNode; next: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
         style={{ borderColor: v("--ux-line") }}>
      {back}
      {next}
    </div>
  );
}
