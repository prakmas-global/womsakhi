"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useToast } from "@/design-system";
import { Pill } from "@/components/ux/kit";
import { SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { Group } from "../_parts/Group";
import {
  Confirm, DangerButton, Intro, LANGUAGE_NAMES, LoadFailed, LoadingRows, QuietButton,
} from "../_parts/personal";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";
import {
  apiDeleteAnswers, apiMyData, apiSetConsents, PURPOSE_LABELS, TIME_LABELS, when,
  type MyData, type Purpose, type WorkProfile,
} from "@/lib/personal-api";

/**
 * Settings → My data.
 *
 * What WomSakhi keeps from her answers and what she agreed to, each choice
 * undone in the same number of taps it took to give (DPDP), and the record of
 * every change. Plain words throughout: she should be able to read this page
 * aloud to someone and have them understand it.
 *
 * The two job choices follow the server's rules exactly:
 *   · employers can see her work profile only while she keeps job updates on;
 *   · turning job updates off turns employer visibility off too — so that one
 *     change is confirmed first, on the page, never with `window.confirm`.
 */

const FIELD_NAMES: Record<string, string> = { name: "Your name", skills: "Your skills", city: "Your city" };

function EmployerCard({ p, on }: { p: WorkProfile | null; on: boolean }) {
  /*
    Exactly what an employer's search shows — the server's own list,
    `employers_see`, when she has said yes; the same three fields as a preview
    when she has not. Never her phone or email.
  */
  const fields = on && p ? p.employers_see : ["name", "skills", "city"];
  const value = (f: string) =>
    !p ? "" : f === "name" ? p.name : f === "city" ? p.city : f === "skills" ? p.skills.join(", ") : "";
  return (
    <div className="ux-sq rounded-[14px] p-4" style={{ background: "var(--ux-surface-2)", border: "1px dashed var(--ux-line-strong)" }}>
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold lg:text-xs" style={{ color: "var(--ux-muted)" }}>
        <Icons.Eye className="h-3.5 w-3.5" aria-hidden />
        {on ? "What employers see now" : "What employers would see if you said yes"}
      </p>
      <dl className="mt-2.5 space-y-2">
        {fields.map((f) => (
          <div key={f} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>{FIELD_NAMES[f] ?? f}</dt>
            <dd className="min-w-0 break-words text-end text-[15px] font-semibold lg:text-sm" style={{ color: value(f) ? "var(--ux-ink)" : "var(--ux-muted)" }}>
              {value(f) || "Not added yet"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-ink-2)" }}>
        <Icons.Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-green-ink)" }} aria-hidden />
        Your phone number and email are never shown. Your number is shared only when you say yes to a specific job.
      </p>
      {p && !p.verified && on && (
        <p className="mt-2 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
          Hidden from employers until your account is approved.
        </p>
      )}
    </div>
  );
}

function Kept({ p }: { p: WorkProfile }) {
  const rows: [string, string][] = [
    ["Name", p.name],
    ["Mobile", p.mobile],
    ["Email", p.email],
    ["City", p.city],
    ["Languages", p.languages.map((l) => LANGUAGE_NAMES[l] ?? l).join(", ")],
    ["Skills", p.skills.join(", ")],
    ["Work you want", p.wants.join(", ")],
    ["When you're free", p.free_times.map((t) => TIME_LABELS[t] ?? t).join(", ")],
  ];
  return (
    <dl className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5" style={{ borderColor: "var(--ux-line)" }}>
          <dt className="text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>{k}</dt>
          <dd className="min-w-0 break-words text-end text-[15px] font-medium lg:text-sm" style={{ color: v ? "var(--ux-ink)" : "var(--ux-muted)" }}>
            {v || "Not added"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const SHORT: Record<Purpose, string> = {
  setup: "Setting up my WomSakhi",
  job_updates: "Job updates",
  employer_visibility: "Employers can see my work profile",
};

export default function MyDataPage() {
  const toast = useToast();
  const { data, source, refetch } = useResource<MyData | null>(
    useCallback((s: AbortSignal) => apiMyData(s), []), null,
  );
  // The state she just chose, shown straight away. It is tied to the response
  // it was chosen against, so the refetch that follows replaces it by itself.
  const [local, setLocal] = useState<{ on: MyData | null; v: Partial<Record<Purpose, boolean>> }>({ on: null, v: {} });
  const [saving, setSaving] = useState<Purpose | null>(null);
  const [askJobsOff, setAskJobsOff] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (askJobsOff) document.getElementById("jobs-off")?.focus();
  }, [askJobsOff]);
  useEffect(() => {
    if (askDelete) document.getElementById("delete-answers")?.focus();
  }, [askDelete]);

  const granted = (p: Purpose) =>
    (local.on === data ? local.v[p] : undefined) ?? data?.consents[p].granted ?? null;

  const change = async (p: Purpose, value: boolean) => {
    setSaving(p);
    const before = local;
    setLocal((l) => ({ on: data, v: { ...(l.on === data ? l.v : {}), [p]: value,
      ...(p === "job_updates" && !value ? { employer_visibility: false } : {}) } }));
    try {
      await apiSetConsents({ [p]: value });
      toast.success(value ? `${SHORT[p]}: on` : `${SHORT[p]}: off`,
        { description: "Saved, with the time you changed it." });
      refetch();
    } catch (e) {
      setLocal(before);
      toast.error("That did not go through", { description: messageFrom(e, "Your choice is unchanged. Try again in a moment.") });
    } finally {
      setSaving(null);
      setAskJobsOff(false);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await apiDeleteAnswers();
      setAskDelete(false);
      toast.success("Your answers are deleted", { description: "Your job choices are off. Things you made are still yours." });
      refetch();
    } catch (e) {
      toast.error("That did not go through", { description: messageFrom(e, "Nothing was deleted. Try again in a moment.") });
    } finally {
      setDeleting(false);
    }
  };

  if (!data) {
    return (
      <SettingsPage title="My data" sub="What WomSakhi keeps from your answers, and what you agreed to.">
        {source === "loading" ? <LoadingRows label="Loading your data" rows={5} />
          : <LoadFailed what="your data" onRetry={refetch} />}
      </SettingsPage>
    );
  }

  const jobs = granted("job_updates") === true;
  const employers = granted("employer_visibility") === true;
  const setup = granted("setup");
  const hasAnswers = Object.values(data.answers).some((v) => v !== null && !(Array.isArray(v) && v.length === 0));
  const history = [...data.consent_history].reverse();

  return (
    <SettingsPage title="My data" sub="What WomSakhi keeps from your answers, and what you agreed to.">
      <Intro image="/ux/onboarding/privacy-480.webp">
        Every choice here is yours, and you can undo it in the same number of taps. We never sell your details or share them outside WomSakhi.
      </Intro>

      <Group title="Your choices" inset="rows">
        {/* The base consent: always shown, as the state it is in. It is given or
            taken back on the first question screen and by deleting answers. */}
        <div className="flex min-h-[52px] items-start justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold lg:text-sm lg:font-medium" style={{ color: "var(--ux-ink)" }}>
              {PURPOSE_LABELS.setup}
            </p>
            <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
              {setup === true ? "Your answers shape your home and the drafts we prepare. Only you see them."
                : setup === false ? "Your answers are not used to set anything up."
                : "You haven't been asked yet. It's the first question screen."}
            </p>
          </div>
          <span className="mt-0.5 shrink-0">
            <Pill tone={setup === true ? "green" : "neutral"} size="sm">
              {setup === true ? "Yes" : setup === false ? "No" : "Not asked yet"}
            </Pill>
          </span>
        </div>
        <div className="border-t" style={{ borderColor: "var(--ux-line)" }} />

        <Toggle
          label={PURPOSE_LABELS.job_updates}
          on={jobs}
          busy={saving === "job_updates"}
          onChange={(v) => { if (v) void change("job_updates", true); else setAskJobsOff(true); }}
          whenOn="We keep a work profile and tell you about jobs and work that match you — even before you're approved."
          whenOff="No work profile is kept, and we won't send you job updates."
        />
        {askJobsOff && (
          <div className="pb-3">
            <Confirm id="jobs-off" title="Turn off job updates?"
              actions={<>
                <QuietButton onClick={() => setAskJobsOff(false)}>Keep them on</QuietButton>
                <DangerButton solid busy={saving === "job_updates"} onClick={() => void change("job_updates", false)}>
                  Turn off
                </DangerButton>
              </>}>
              We&apos;ll stop keeping your work profile and stop sending job updates.
              {employers && " Employers will no longer be able to see you, either."}
            </Confirm>
          </div>
        )}
        <div className="border-t" style={{ borderColor: "var(--ux-line)" }} />

        <Toggle
          label={PURPOSE_LABELS.employer_visibility}
          on={employers}
          disabled={!jobs}
          busy={saving === "employer_visibility"}
          onChange={(v) => void change("employer_visibility", v)}
          whenOn="Employers and partners with WomSakhi accounts can find your name, skills and city."
          whenOff={jobs ? "Employers can't find you. Your work profile is only used to send you matches."
            : "Turn on job updates first — employers can only see a work profile you keep."}
        />
      </Group>

      <Group title="Your work profile" inset="form"
             sub={data.work_profile ? "This is kept because job updates are on." : undefined}>
        {data.work_profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={data.work_profile.verified ? "green" : "orange"} size="sm">
                {data.work_profile.verified ? "Approved account" : "Not verified yet"}
              </Pill>
              <Pill tone={employers ? "blue" : "neutral"} size="sm">
                {employers ? "Employers can find you" : "Hidden from employers"}
              </Pill>
            </div>
            <EmployerCard p={data.work_profile} on={employers} />
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>
                Everything we keep for job matches
              </h3>
              <Kept p={data.work_profile} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
              You don&apos;t have a work profile. Turn on job updates above and we&apos;ll keep one from your answers.
            </p>
            <EmployerCard p={null} on={false} />
          </div>
        )}
      </Group>

      <Group title="When your choices changed" inset="form"
             chip={history.length ? String(history.length) : undefined}>
        {history.length === 0 ? (
          <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-muted)" }}>
            No choices recorded yet.
          </p>
        ) : (
          <ol className="-my-1 divide-y" style={{ borderColor: "var(--ux-line)" }} aria-label="Every change, newest first">
            {history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5" style={{ borderColor: "var(--ux-line)" }}>
                <span aria-hidden className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                      style={h.granted ? { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }
                                       : { background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
                  {h.granted ? <Icons.Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icons.X className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug lg:text-sm" style={{ color: "var(--ux-ink)" }}>
                    {SHORT[h.purpose] ?? h.purpose}: {h.granted ? "yes" : "no"}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug tabular-nums lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                    {[when(h.at), h.language && `in ${LANGUAGE_NAMES[h.language] ?? h.language}`, h.notice_version && `notice ${h.notice_version}`]
                      .filter(Boolean).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Group>

      <Group title="Delete my answers" inset="form">
        <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
          This deletes every answer and your work profile, and turns every choice above off.
          Things you already made — a draft, a goal you kept — stay yours. The record of your choices is kept, because it shows you took them back.
        </p>
        <div className="mt-3.5">
          {askDelete ? (
            <Confirm id="delete-answers" title="Delete all your answers?"
              actions={<>
                <QuietButton onClick={() => setAskDelete(false)}>Keep my answers</QuietButton>
                <DangerButton solid busy={deleting} onClick={() => void deleteAll()}>Yes, delete them</DangerButton>
              </>}>
              Your home goes back to the standard order. You can answer again any time.
            </Confirm>
          ) : (
            <DangerButton onClick={() => setAskDelete(true)}>
              {hasAnswers ? "Delete my answers" : "Delete my answers and choices"}
            </DangerButton>
          )}
        </div>
      </Group>

      <p className="px-4 text-[13px] leading-snug lg:px-0 lg:text-xs" style={{ color: "var(--ux-muted)" }}>
        To see or change the answers themselves, open{" "}
        <Link href="/app/settings/answers" className="-my-3 inline-flex min-h-[44px] items-center font-semibold underline" style={{ color: "var(--ux-brand)" }}>My answers</Link>.
      </p>
    </SettingsPage>
  );
}
