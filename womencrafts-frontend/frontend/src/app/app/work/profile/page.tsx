"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, Pill, ScreenSkeleton } from "@/components/ux/kit";
import { Label, Picks, Select, Toggle } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { toast } from "@/components/ux/mobile/Toast";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";
import {
  apiMyWorkProfile, apiSaveWorkProfile, apiWorkTaxonomy,
  type ProfileSkill, type WorkCategory, type WorkProfile,
} from "@/lib/work-api";

/**
 * My work profile — the skills she can do, and, skill by skill, whether people
 * hiring may find her for it (backend: routes/work_talent.py).
 *
 * Almost all taps: a category, then its skills as chips; a level per skill as
 * one tap; the switch beside each. The first visit is filled from what she
 * said when she joined — with every skill switched OFF, because nobody asked
 * her then whether to be findable, and silence is not a yes.
 */

const MAX = 20;

export default function WorkProfilePage() {
  const prof = useResource(useCallback((s: AbortSignal) => apiMyWorkProfile(s), []), null as WorkProfile | null);
  const tax = useResource(useCallback((s: AbortSignal) => apiWorkTaxonomy(s), []), [] as WorkCategory[]);

  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [cat, setCat] = useState("");
  const [dirty, setDirty] = useState(false);

  // Server truth into the form, once per load — adjusted during render rather
  // than in an effect, so the first paint already shows her skills.
  const [loaded, setLoaded] = useState<WorkProfile | null>(null);
  if (prof.data && prof.data !== loaded) {
    const p = prof.data;
    setLoaded(p);
    setSkills(p.skills); setWorkTypes(p.work_types); setDays(p.days);
    setArea(p.area); setCity(p.city); setDirty(false);
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const category = tax.data.find((c) => c.key === cat);
  const offered = useMemo(
    () => (category ? [...category.skills].sort((a, b) => Number(b.popular) - Number(a.popular)) : []),
    [category],
  );
  const have = new Set(skills.map((s) => s.key));

  const addOrRemove = (key: string) => {
    if (!category) return;
    if (have.has(key)) { setSkills(skills.filter((s) => s.key !== key)); setDirty(true); return; }
    if (skills.length >= MAX) { toast(`Up to ${MAX} skills`, { tone: "error" }); return; }
    const opt = category.skills.find((s) => s.key === key)!;
    // She is choosing it now, so it is on; she can switch it off below.
    setSkills([...skills, {
      key, name: opt.name, category: category.key, category_name: category.name,
      level: "", visible: true, verified: false,
    }]);
    setDirty(true);
  };
  const patch = (key: string, over: Partial<ProfileSkill>) => {
    setSkills(skills.map((s) => (s.key === key ? { ...s, ...over } : s)));
    setDirty(true);
  };

  const groups = useMemo(() => {
    const m = new Map<string, ProfileSkill[]>();
    for (const s of skills) m.set(s.category_name, [...(m.get(s.category_name) ?? []), s]);
    return [...m.entries()];
  }, [skills]);
  const shownFor = skills.filter((s) => s.visible).length;

  const save = useAction(
    async () => {
      const got = await apiSaveWorkProfile({
        skills: skills.map((s) => ({ key: s.key, level: s.level, visible: s.visible })),
        work_types: workTypes, days, area: area.trim(), city: city.trim(),
      });
      setSkills(got.skills); setDirty(false);
      // Reload so `saved`, the banner and the "shown for" count are the
      // server's — the old data stays on screen while it comes back.
      prof.refetch();
      toast("Saved", { tone: "success" });
    },
    { fallbackError: "That did not save. Check your connection and try again." },
  );

  const status = (prof.error as { response?: { status?: number } } | null)?.response?.status;
  if (prof.source === "loading") return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;
  if (!prof.data) {
    return (
      <HomeShell>
        <ScreenHead title="My work profile" />
        <Card>
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
            {status === 403
              ? "Your work profile opens once your account is verified. We will tell you as soon as it is."
              : "Your work profile could not load. Check your connection and try again."}
          </p>
          {status !== 403 && <div className="mt-3"><Btn size="sm" variant="outline" onClick={prof.refetch}>Try again</Btn></div>}
        </Card>
      </HomeShell>
    );
  }
  const p = prof.data;
  const levelLabel = (key: string) => p.levels.find((l) => l.key === key)?.label ?? "";

  return (
    <HomeShell>
      <ScreenHead title="My work profile"
                  sub="Pick the work you can do. Switch on a skill to let verified WomSakhi members who are hiring find you for it. Your phone number is never shown." />

      {!p.saved && (
        <Card className="mb-[16px]" style={{ background: "var(--ux-tint-amber)" }}>
          <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: "var(--ux-amber-ink)" }}>
            <Icons.Info className="mt-[2px] h-4 w-4 shrink-0" />
            We filled this from what you told us when you joined. Check it and save.
          </p>
        </Card>
      )}

      {/* Who can find her, in one line. */}
      <Card className="mb-[16px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full"
                style={{ background: shownFor ? "var(--ux-tint-green)" : "var(--ux-surface-2)" }}>
            {shownFor
              ? <Icons.Eye className="h-5 w-5" style={{ color: "var(--ux-green-ink)" }} />
              : <Icons.EyeOff className="h-5 w-5" style={{ color: "var(--ux-muted)" }} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
              {shownFor
                ? `People hiring can find you for ${shownFor} ${shownFor === 1 ? "skill" : "skills"}`
                : "Nobody can find you yet — switch on a skill below"}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
              They see your first name, area and those skills. They message you here; you decide whether to share your number.
            </p>
          </div>
          <Link href="/app/work/find" className="text-xs font-semibold hover:underline" style={{ color: "var(--ux-brand)" }}>
            Looking to hire? Find people →
          </Link>
        </div>
      </Card>

      {/* Add skills: a category, then its skills as taps. */}
      <Card className="mb-[16px]">
        <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>Add the work you can do</h2>
        <div className="mt-3 max-w-[420px]">
          <Label>Category</Label>
          <Select value={cat} onChange={setCat} label="Category" placeholder="Choose a category"
                  options={tax.data.map((c) => ({ value: c.key, label: c.name }))} />
        </div>
        {category ? (
          <>
            <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>Tap every skill you have. Tap again to remove it.</p>
            <Picks options={offered.map((s) => s.name)}
                   value={offered.filter((s) => have.has(s.key)).map((s) => s.name)}
                   multi label={`${category.name} skills`}
                   onPick={(name) => addOrRemove(offered.find((s) => s.name === name)!.key)} />
          </>
        ) : (
          <p className="mt-3 text-xs" style={{ color: "var(--ux-faint)" }}>Pick a category to see its skills.</p>
        )}
        <p className="mt-3 text-2xs" style={{ color: "var(--ux-faint)" }}>{skills.length} of {MAX} skills</p>
      </Card>

      {/* Her skills, by category. */}
      {groups.length > 0 ? groups.map(([name, rows]) => (
        <Card key={name} className="mb-[16px]">
          <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>{name}</p>
          <ul className="mt-2 divide-y" style={{ borderColor: "var(--ux-line)" }}>
            {rows.map((s) => (
              <li key={s.key} className="py-3.5" style={{ borderColor: "var(--ux-line)" }}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {s.name}
                      {s.verified && <Pill tone="green" size="sm">Verified</Pill>}
                      {!s.visible && <Pill tone="neutral" size="sm">Hidden</Pill>}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                      {s.level ? `How long: ${levelLabel(s.level)}` : "How long have you done it?"}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setSkills(skills.filter((x) => x.key !== s.key)); setDirty(true); }}
                          aria-label={`Remove ${s.name}`}
                          className="ux-press grid h-8 w-8 shrink-0 place-items-center rounded-full"
                          style={{ color: "var(--ux-muted)" }}>
                    <Icons.X className="h-4 w-4" />
                  </button>
                </div>
                <Picks options={p.levels.map((l) => l.label)} value={levelLabel(s.level)}
                       label={`How long — ${s.name}`}
                       onPick={(label) => {
                         const key = p.levels.find((l) => l.label === label)?.key ?? "";
                         patch(s.key, { level: s.level === key ? "" : key });
                       }} />
                <div className="mt-3 rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
                  <Toggle on={s.visible} onChange={(v) => patch(s.key, { visible: v })}
                          label="Show me for this"
                          sub={s.visible ? "People hiring can find you for this skill." : "Hidden — nobody hiring sees this skill."} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )) : (
        <Card className="mb-[16px]">
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No skills yet. Pick a category above and tap what you can do.</p>
        </Card>
      )}

      {/* How and where she works. */}
      <Card className="mb-[16px]">
        <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>How you like to work</h2>
        <div className="mt-3">
          <Label>Kind of work</Label>
          <Picks options={p.work_type_options} value={workTypes} multi label="Kind of work"
                 onPick={(w) => touch(setWorkTypes)(toggleIn(workTypes, w))} />
        </div>
        <div className="mt-4">
          <Label>When you are free</Label>
          <Picks options={p.day_options} value={days} multi label="When you are free"
                 onPick={(d) => touch(setDays)(toggleIn(days, d))} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Label hint="optional">Area</Label>
            <input value={area} maxLength={80} onChange={(e) => touch(setArea)(e.target.value)}
                   placeholder="Your colony or locality"
                   className="ux-sq min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </label>
          <label className="block">
            <Label>City</Label>
            <input value={city} maxLength={80} onChange={(e) => touch(setCity)(e.target.value)}
                   placeholder="Your city or town"
                   className="ux-sq min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </label>
        </div>
      </Card>

      {/* Save, kept in reach. */}
      {/* Solid, and clear of the Sakhi bubble in the corner. */}
      <div className="sticky bottom-[84px] z-10 lg:bottom-4 lg:pe-[76px]">
        <Card style={{ background: "var(--ux-surface)", boxShadow: "0 10px 30px -12px rgba(30,10,40,.28)" }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs" style={{ color: save.error ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
              {save.error || (dirty || !p.saved ? "You have changes that are not saved yet." : "Everything is saved.")}
            </p>
            <Btn variant="primary" icon="Check" loading={save.busy} disabled={!dirty && p.saved}
                 onClick={() => void save.run()}>
              Save my work profile
            </Btn>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
