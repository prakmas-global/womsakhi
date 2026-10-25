"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, Chip, EmptyState, NoteBtn } from "@/components/ux/kit";
import { Label, Select, Toggle } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow, ScreenHead } from "@/components/ux/learning/native";
import { useResource } from "@/lib/use-resource";
import { apiFindTalent, apiMessageTalent, apiWorkTaxonomy, type Talent, type WorkCategory } from "@/lib/work-api";
import { Fact, MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/**
 * Find people to hire — for any verified member: a boutique owner looking for
 * a tailor, a caterer short of a cook.
 *
 * Only women who switched a skill on to be found for it ever appear, and only
 * for that skill (backend: routes/work_talent.py). A card shows her first
 * name, area and the matching skills — never a phone. "Message" opens a
 * WomSakhi chat; whether to share her number is her decision, in that chat.
 *
 * Everything is picked rather than typed: a category, then skills, then
 * one-tap filters. The town box is the only typing, and it is optional.
 */

const LEVELS = [
  { key: "", label: "Any experience" },
  { key: "1-2", label: "1–2 years+" },
  { key: "3-5", label: "3–5 years+" },
  { key: "5+", label: "5+ years" },
];
const WORK_TYPES = ["Any", "Full-time", "Part-time", "From home", "Per order"];

/**
 * Kinds of work whose names carry no keyword the shared picker knows — picked
 * by hand so every tile shows the work itself.
 */
const CATEGORY_ART: Record<string, string> = {
  farming_animals: "/ux/art/scene-woman-planting-sapling.webp",
  home_services: "/ux/art/circle-sharing-help.webp",
  care_work: "/ux/art/work-dashboard-support.webp",
  arts_performance: "/ux/art/course-confident-microphone.webp",
  events_hospitality: "/ux/art/circle-rooftop-evening.webp",
};

const categoryArt = (c: WorkCategory) =>
  artFor([c.name, c.skills.map((s) => s.name).join(" ")], "service", CATEGORY_ART[c.key], c.key);

function TalentCard({ t, skillKeys, onSent }: { t: Talent; skillKeys: string[]; onSent: () => void }) {
  const place = [t.area, t.city].filter(Boolean).join(" · ");
  const phrases = [
    ...t.skills.slice(0, 2).map((s) => `I need help with ${s.name.toLowerCase()}`),
    "Is this work near you?", "Full-time work", "Part-time work", "Work from home",
    "Paid per piece", "When can you start?",
  ];
  const top = t.skills[0];
  return (
    <MediaCard
      image={artFor(t.skills.map((s) => s.name), "service", undefined, t.user_id)}
      alt={top ? top.name : t.first_name}
      topLeft={t.verified ? { text: "✓ Verified skill", tone: "green" } : top ? { text: top.name, tone: "light" } : null}
      topRight={top?.level ? { text: top.level, tone: "dark" } : null}
      overlay={t.skills.length > 1 ? <><Icons.Sparkles className="h-[13px] w-[13px]" />{t.skills.length} of the skills you asked for</> : null}
      title={t.first_name}
      subtitle={place || "Place not given"}
      avatar={{ src: t.avatar || undefined, name: t.first_name }}
      meta={<>
        {t.work_types.length > 0 && <Fact icon="Briefcase">{t.work_types.join(", ")}</Fact>}
        {t.days.length > 0 && <Fact icon="Clock">{t.days.join(", ")}</Fact>}
      </>}
      footer={
        <div className="flex [&>*]:w-full">
          {t.conversation_id ? (
            <Btn href={`/app/messages?c=${t.conversation_id}`} variant="outline" size="sm" icon="MessageCircle" full>Continue chat</Btn>
          ) : (
            <NoteBtn label="Message" variant="primary" size="sm" icon="MessageCircle" full
                     title={`Message ${t.first_name} about work`} to={t.first_name}
                     placeholder="Say what the work is, where, and when."
                     phrases={phrases}
                     send={async (n) => {
                       await apiMessageTalent(t.user_id, n.text, t.skills.map((x) => x.key).filter((k) => !skillKeys.length || skillKeys.includes(k)));
                     }}
                     sent={`Your message is with ${t.first_name}`}
                     sentBody="She will see it in Messages. If she wants to, she can share her number with you there."
                     sentLink={{ href: "/app/messages", label: "Open Messages" }}
                     onSentClosed={onSent} />
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {t.skills.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
            {s.name}
            {s.level && <span className="font-normal" style={{ color: "var(--ux-muted)" }}>· {s.level}</span>}
            {s.verified && <Icons.BadgeCheck className="h-3 w-3" style={{ color: "var(--ux-green-ink)" }} aria-label="Verified" />}
          </span>
        ))}
      </div>
      {t.also.length > 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>Also: {t.also.join(", ")}</p>
      )}
    </MediaCard>
  );
}

export default function FindPeoplePage() {
  const { data: cats, source: catSource } = useResource(
    useCallback((s: AbortSignal) => apiWorkTaxonomy(s), []), [] as WorkCategory[]);

  const [cat, setCat] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [workType, setWorkType] = useState("Any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [tick, setTick] = useState(0);

  // The town box only: wait until she stops typing.
  useEffect(() => {
    const t = window.setTimeout(() => setCity(cityInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [cityInput]);

  const category = cats.find((c) => c.key === cat);
  const query = useMemo(() => ({
    category: cat, skills: picked, city, level,
    work_type: workType === "Any" ? "" : workType, verified_only: verifiedOnly,
  }), [cat, picked, city, level, workType, verifiedOnly]);
  const key = cat ? `${JSON.stringify(query)}#${tick}` : "";

  const [result, setResult] = useState<{ key: string; rows: Talent[]; total: number; status: number }>(
    { key: "", rows: [], total: 0, status: 0 });
  useEffect(() => {
    if (!key) return;
    const ctl = new AbortController();
    apiFindTalent(query, ctl.signal)
      .then((d) => setResult({ key, rows: d.results, total: d.total, status: 200 }))
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setResult({ key, rows: [], total: 0, status: axios.isAxiosError(e) ? e.response?.status ?? 0 : 0 });
      });
    return () => ctl.abort();
  }, [key, query]);
  const loading = !!key && result.key !== key;

  const pickCategory = (k: string) => { setCat(k); setPicked([]); };
  const toggleSkill = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const clearFilters = () => { setPicked([]); setLevel(""); setWorkType("Any"); setVerifiedOnly(false); setCityInput(""); setCity(""); };
  const skillKeys = picked.length ? picked : (category?.skills.map((s) => s.key) ?? []).slice(0, 10);

  return (
    <HomeShell active="/app/work/find">
      <ScreenHead title="Find people to hire"
                  sub="Women who switched on a skill to be found for it. You see first name, area and skills — never a phone number. Start a chat; she decides whether to share her number." />

      <Card className="mb-[16px]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label need>What work do you need done?</Label>
            <Select value={cat} onChange={pickCategory} label="Category" placeholder="Choose a kind of work"
                    options={cats.map((c) => ({ value: c.key, label: c.name }))} />
          </div>
          <div>
            <Label hint="optional">Town or area</Label>
            <span className="flex min-h-[46px] items-center gap-2 rounded-[12px] border px-3.5"
                  style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}>
              <Icons.MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} />
              <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} maxLength={80}
                     placeholder="e.g. Kukatpally or Hyderabad" aria-label="Town or area"
                     className="min-h-[44px] w-full bg-transparent text-xsm outline-none" style={{ color: "var(--ux-ink)" }} />
            </span>
          </div>
        </div>

        {category && (
          <>
            <div className="mt-4">
              <Label hint="tap any — none means all of them">Skills</Label>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((s) => (
                  <Chip key={s.key} selected={picked.includes(s.key)} onClick={() => toggleSkill(s.key)}>{s.name}</Chip>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <ChipRow label="Experience">
                {LEVELS.map((l) => <Chip key={l.key || "any"} selected={level === l.key} onClick={() => setLevel(l.key)}>{l.label}</Chip>)}
              </ChipRow>
            </div>
            <div className="mt-3">
              <ChipRow label="Kind of work">
                {WORK_TYPES.map((w) => <Chip key={w} selected={workType === w} onClick={() => setWorkType(w)}>{w}</Chip>)}
              </ChipRow>
            </div>
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
              <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified skill only"
                      sub="Only women who passed a WomSakhi skill test for this kind of work." />
            </div>
          </>
        )}
      </Card>

      {!cat ? (
        <>
          <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
            Or tap a kind of work
          </p>
          {catSource === "loading" && !cats.length ? (
            <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p></Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {cats.map((c) => (
                <button key={c.key} type="button" onClick={() => pickCategory(c.key)}
                        className="ux-card ux-press group relative flex aspect-[4/3] flex-col justify-end overflow-hidden text-start"
                        style={{ padding: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={categoryArt(c)} alt="" loading="lazy" decoding="async"
                       className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                  <span aria-hidden className="absolute inset-0"
                        style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 35%, rgba(16,6,24,.82))" }} />
                  <span className="relative p-3">
                    <span className="block text-sm font-bold text-white">{c.name}</span>
                    <span className="block text-2xs text-white/80">{c.skills.length} skills</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : result.status === 403 && !loading ? (
        <Card>
          <EmptyState icon="ShieldCheck" title="Finding people opens once your account is verified"
                      body="Our team checks every member before she can contact other women. You will get a message as soon as you are verified." />
        </Card>
      ) : loading ? (
        <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>Looking…</p></Card>
      ) : result.status !== 200 ? (
        <Card>
          <EmptyState icon="WifiOff" title="That search did not load"
                      body="Check your connection and try again."
                      action={<Btn variant="soft" onClick={() => setTick((n) => n + 1)}>Try again</Btn>} />
        </Card>
      ) : result.rows.length ? (
        <>
          <p className="mb-2.5 text-xsm font-semibold" style={{ color: "var(--ux-ink-2)" }}>
            {result.total} {result.total === 1 ? "woman" : "women"} found
          </p>
          <MediaGrid>
            {result.rows.map((t) => (
              <TalentCard key={t.user_id} t={t} skillKeys={skillKeys} onSent={() => setTick((n) => n + 1)} />
            ))}
          </MediaGrid>
        </>
      ) : (
        <Card>
          <EmptyState icon="SearchX" title="Nobody has switched on that skill yet"
                      body="Try fewer skills, any experience, or leave the town empty. Women add skills every day."
                      action={<Btn variant="soft" onClick={clearFilters}>Clear filters</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}
