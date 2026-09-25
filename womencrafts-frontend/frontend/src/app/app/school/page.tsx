"use client";

import { useCallback, useMemo, useState } from "react";
import { useResource } from "@/lib/use-resource";
import {
  apiAddChild, apiAddSchoolTask, apiEditSchoolTask, apiRemoveChild, apiSchool,
  type School, type SchoolKind,
} from "@/lib/life-api";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Select, Text } from "@/components/ux/kit/form";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, Progress, SourceNote, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  SCHOOL_KIND as RAW_SCHOOL_KIND,
} from "@/components/ux/life/data";
import { ChipRow, SectionLabel } from "@/components/ux/learning/native";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * The school year — hers to run, and nobody has ever helped her run it.
 *
 * ── The emptiest gap in the whole review ────────────────────────────────────
 * Schools broadcast *to* parents. Portals serve students. Fee lenders serve
 * schools. The only mother-side product found anywhere in the world is a
 * $9.99/month American assistant for affluent families. And yet she is the one
 * holding every fee date, exam date, RTE window, scholarship deadline, uniform
 * size and missing certificate — usually in her head, usually alone.
 *
 * ── Why it fits this product particularly well ──────────────────────────────
 * It is deadline-shaped, so it brings her back without a streak or a badge —
 * which matters, because this app's own doctrine forbids engagement mechanics.
 * It plugs straight into the savings pot: a fee pot per child, per term, is the
 * single most motivating goal a mother has. And mothers at one school are
 * already a circle, so it seeds itself.
 */
/** Nothing invented, ever. A woman with no children sees no children. */
const EMPTY_SCHOOL: School = {
  children: [], tasks: [], due_minor: 0, fee_minor: 0, saved_minor: 0, pending: 0,
};

export default function SchoolPage() {
  const SCHOOL_KIND = useTranslated(RAW_SCHOOL_KIND);

  /**
   * Her children, from her account.
   *
   * This screen shipped with a family written into it: Anaya in Class 4 at
   * "Govt. Primary, Sector 9" and Vihaan in Class 8, ₹8,400 of fees with
   * ₹5,200 already saved, and six dated tasks belonging to them — a
   * scholarship renewal in 12 days, an RTE seat to confirm in 3.
   *
   * Every woman saw that family, including women with no children. And the
   * deadlines were the dangerous part: a woman could read "RTE seat, 3 days"
   * and lose a day's earnings at a school office over a seat that did not
   * exist.
   */
  const school = useResource<School>(useCallback((sig) => apiSchool(sig), []), EMPTY_SCHOOL);
  const CHILDREN = school.data.children;
  const tr = useT();
  const router = useRouter();
  const tasks = school.data.tasks;
  const [child, setChild] = useState<string>("all");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const due = school.data.due_minor;
  // Within a week, counted from today's real date rather than a stored number.
  const soon = useMemo(
    () => tasks.filter((t) => !t.done && t.due_in !== null && t.due_in <= 7).length,
    [tasks],
  );

  const shown = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return child === "all" ? open : open.filter((t) => t.child_id === child);
  }, [tasks, child]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  /** Saved, not just crossed off. It used to be React state and came back
   *  undone on reload, which on a list of deadlines is the wrong direction. */
  const finish = useCallback(async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    setBusy(id); setErr(null);
    try {
      await apiEditSchoolTask(id, { done: true });
      setNote(`${t?.what} — done. One less thing to hold in your head.`);
      school.refetch();
    } catch {
      setErr("That did not save. It is still on the list.");
    } finally { setBusy(null); }
  }, [tasks, school]);

  const nameOf = (id: string) => CHILDREN.find((c) => c.id === id)?.name ?? "";

  /* ── adding a child, and a date for her ─────────────────────────────── */
  const [sheet, setSheet] = useState<"child" | "task" | null>(null);
  const [kName, setKName] = useState("");
  const [kCls, setKCls] = useState("");
  const [kSchool, setKSchool] = useState("");
  const [kFee, setKFee] = useState("");
  const [tWhat, setTWhat] = useState("");
  const [tDetail, setTDetail] = useState("");
  const [tKind, setTKind] = useState<SchoolKind>("date");
  const [tDue, setTDue] = useState("");
  const [tCost, setTCost] = useState("");
  const [tChild, setTChild] = useState("");

  const saveChild = useCallback(async () => {
    if (!kName.trim()) { setErr("What is her name?"); return; }
    const fee = Number(kFee.replace(/[^0-9.]/g, ""));
    setBusy("child"); setErr(null);
    try {
      await apiAddChild({
        name: kName.trim(), cls: kCls.trim(), school: kSchool.trim(),
        fee_minor: Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) : 0,
      });
      setNote(`${kName.trim()} added.`);
      setSheet(null); setKName(""); setKCls(""); setKSchool(""); setKFee("");
      school.refetch();
    } catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [kName, kCls, kSchool, kFee, school]);

  const saveTask = useCallback(async () => {
    if (!tWhat.trim()) { setErr("What is it?"); return; }
    const cost = Number(tCost.replace(/[^0-9.]/g, ""));
    setBusy("task"); setErr(null);
    try {
      await apiAddSchoolTask({
        child_id: tChild || undefined, what: tWhat.trim(), detail: tDetail.trim(),
        kind: tKind, due: tDue ? new Date(tDue).toISOString() : null,
        cost_minor: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) : 0,
      });
      setNote("Added. It will show here with the days counted from today.");
      setSheet(null); setTWhat(""); setTDetail(""); setTDue(""); setTCost("");
      school.refetch();
    } catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [tWhat, tDetail, tKind, tDue, tCost, tChild, school]);

  const dropChild = useCallback(async (id: string, name: string) => {
    setBusy(id); setErr(null);
    try {
      await apiRemoveChild(id);
      setNote(`${name} removed, along with her dates.`);
      school.refetch();
    } catch { setErr("Could not remove that."); }
    finally { setBusy(null); }
  }, [school]);

  const empty = school.source !== "loading" && CHILDREN.length === 0 && tasks.length === 0;

  return (
    <HomeShell active="/app/school">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("school.theSchoolYear")}</p>
          {/* `.ux-screen-title` makes this the one 34px large title on a phone;
              the clamp is what desktop keeps. */}
          <h1 className="ux-screen-title mt-1 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] lg:mt-2"
              style={{ color: v("--ux-ink") }}>{tr("school.everyDateInOnePlace")}</h1>
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed lg:mt-1.5" style={{ color: v("--ux-muted") }}>
            Fees, exams, forms, uniforms, the scholarship that has to be renewed or it stops.
            You have been holding all of it. You should not have to.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn icon="Baby" onClick={() => { setSheet("child"); setErr(null); }}>Add a child</Btn>
            {CHILDREN.length > 0 && (
              <Btn variant="outline" icon="CalendarPlus"
                   onClick={() => { setSheet("task"); setErr(null); setTChild(CHILDREN[0].id); }}>
                Add a date
              </Btn>
            )}
          </div>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(due)} label={tr("school.toPayThisTerm")} icon="Wallet"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={String(soon)} label={tr("school.inTheNextWeek")} icon="AlarmClock"
                  tint="--ux-danger-tint" ink="--ux-danger-solid" />
            <Stat value={String(CHILDREN.length)} label="Children" icon="Baby"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
          </div>
        </Card>

        <SourceNote source={school.source} what="these dates" />

        {empty && (
          <EmptyState
            icon="Baby"
            title="Nothing here yet"
            body="Add a child, then the fees, forms, exams and uniform dates that go with her. The days are counted from today, so nothing here can quietly go stale."
            action={<Btn icon="Baby" onClick={() => setSheet("child")}>Add a child</Btn>}
          />
        )}

        {err && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="h-[16px] w-[16px] shrink-0" />{err}
            </p>
          </Card>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Fee pots — the school year is what a savings pot is actually for */}
        <div>
          <SectionLabel title={tr("school.savingForTheFees")} sub={tr("school.aPotForEachChildFilled")}
                        icon="PiggyBank" />
          <div className="grid gap-3 sm:grid-cols-2">
            {CHILDREN.map((c) => {
              const pct = c.fee_minor > 0 ? Math.min(100, (c.saved_minor / c.fee_minor) * 100) : 100;
              return (
                <Card key={c.id} pad={16}>
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-base font-bold"
                          style={{ background: v("--ux-tint-pink"), color: v("--ux-pink-ink") }}>
                      {c.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                        {c.cls} · {c.school}
                      </p>
                    </div>
                  </div>
                  {c.fee_minor > 0 ? (
                    <>
                      <div className="mt-3.5 mb-1.5 flex items-center justify-between text-xs"
                           style={{ color: v("--ux-muted") }}>
                        <span><b style={{ color: v("--ux-ink") }}>{formatRupees(c.saved_minor)}</b> of {formatRupees(c.fee_minor)}</span>
                        <span className="tabular-nums font-bold" style={{ color: v("--ux-brand") }}>{Math.round(pct)}%</span>
                      </div>
                      <Progress pct={pct} />
                      <Btn size="sm" variant="outline" full className="mt-3"
                           onClick={() => setNote(`₹500 added to ${c.name}'s fee pot.`)}>{tr("school.putIn")}</Btn>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[12px] px-4 py-3 lg:mt-3.5 lg:px-3 lg:py-2.5" style={{ background: v("--ux-tint-green") }}>
                      <p className="text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
                        No fees — government school. {formatRupees(c.saved_minor)} saved for books and uniform.
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* What is coming */}
        <div>
          <SectionLabel title={tr("school.whatIsComing")} sub={tr("school.soonestFirst")} icon="CalendarDays"
                        chip={String(shown.length)} />
          <ChipRow className="mb-3 lg:mb-3.5">
            <Chip icon="LayoutGrid" selected={child === "all"} onClick={() => setChild("all")}>{tr("school.bothChildren")}</Chip>
            {CHILDREN.map((c) => (
              <Chip key={c.id} icon="Baby" selected={child === c.id} onClick={() => setChild(c.id)}>{c.name}</Chip>
            ))}
          </ChipRow>

          {shown.length === 0 ? (
            <Card><EmptyState icon="CheckCircle2" title={tr("school.nothingDue")}
                              body={tr("school.everythingForThisChildIsDone")} /></Card>
          ) : (
            <div className="flex flex-col gap-3 lg:gap-2.5">
              {shown.map((t) => {
                const k = SCHOOL_KIND[t.kind];
                const urgent = t.due_in !== null && t.due_in <= 7;
                return (
                  <Card key={t.id} pad={16} style={urgent ? { borderColor: v("--ux-amber") } : undefined}>
                    <div className="flex flex-wrap items-start gap-3.5">
                      <IconTile icon={k.icon} tint={k.tint} ink={k.ink} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{t.what}</p>
                          <Pill tone="neutral" size="sm">{nameOf(t.child_id)}</Pill>
                          {urgent && <Pill tone="orange" size="sm">{t.due_in === 0 ? "Today" : (t.due_in as number) < 0 ? `${Math.abs(t.due_in as number)} days late` : `${t.due_in} days`}</Pill>}
                        </div>
                        <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{t.detail}</p>
                      </div>
                      {t.cost_minor && (
                        <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                          {formatRupees(t.cost_minor)}
                        </p>
                      )}
                      {/* Its own full-width line on a phone — beside the
                          words it squeezed the detail to an 8px column. */}
                      <div className="flex w-full shrink-0 gap-2 [&>*]:flex-1 lg:w-auto lg:[&>*]:flex-none">
                        {t.kind === "buy" && (
                          <Btn size="sm" variant="outline" href="/app/swap">{tr("school.checkTheSwap")}</Btn>
                        )}
                        <Btn size="sm" onClick={() => finish(t.id)}>Done</Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <SectionLabel title={tr("school.alreadyDone")} icon="Check" chip={String(done.length)} />
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {done.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-green-ink") }} />
                    <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                      {t.what} · {nameOf(t.child_id)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      <Sheet
        open={sheet === "child"}
        onClose={() => { setSheet(null); setErr(null); }}
        icon="Baby" title="Add a child"
        description="Only what you want written down. The fee is optional — leave it blank for a government school."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setSheet(null); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy === "child"} onClick={saveChild}>Add</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div><Label need>Her name</Label>
            <Text value={kName} onChange={setKName} label="Her name" placeholder="Meena" max={60} /></div>
          <div><Label>Class</Label>
            <Text value={kCls} onChange={setKCls} label="Which class" placeholder="Class 8" max={40} /></div>
          <div><Label>School</Label>
            <Text value={kSchool} onChange={setKSchool} label="Which school" placeholder="Govt. High School" max={120} /></div>
          <div><Label hint="Leave blank if there are none">Fees for the year</Label>
            <Text value={kFee} onChange={setKFee} label="Fees for the year, in rupees" placeholder="8400" prefix="₹" /></div>
          {err && (
            <p className="flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0" />{err}
            </p>
          )}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "task"}
        onClose={() => { setSheet(null); setErr(null); }}
        icon="CalendarPlus" title="Add a date"
        description="A fee, a form, an exam or something to buy. The days left are counted from today."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setSheet(null); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy === "task"} onClick={saveTask}>Add</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div><Label need>What is it</Label>
            <Text value={tWhat} onChange={setTWhat} label="What it is" placeholder="Second term fees" max={120} /></div>
          <div><Label>Which child</Label>
            <Select value={tChild} onChange={setTChild} label="Which child"
                    options={CHILDREN.map((c) => ({ value: c.id, label: c.name }))} /></div>
          <div><Label>What kind</Label>
            <Select value={tKind} onChange={(x) => setTKind(x as SchoolKind)} label="What kind of thing"
                    options={[
                      { value: "fee", label: "Money to pay" },
                      { value: "form", label: "A form" },
                      { value: "date", label: "A date to keep" },
                      { value: "buy", label: "Something to buy" },
                      { value: "paper", label: "A paper to take" },
                    ]} /></div>
          <div><Label>By when</Label>
            <Text value={tDue} onChange={setTDue} label="The date it is due" type="date" /></div>
          <div><Label hint="Only if it costs money">How much</Label>
            <Text value={tCost} onChange={setTCost} label="How much, in rupees" placeholder="4200" prefix="₹" /></div>
          <div><Label hint="So it makes sense later">A note</Label>
            <Text value={tDetail} onChange={setTDetail} label="A note about it"
                  placeholder="Late after the 10th, then ₹50 a day" max={200} /></div>
          {err && (
            <p className="flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0" />{err}
            </p>
          )}
        </div>
      </Sheet>
    </HomeShell>
  );
}
