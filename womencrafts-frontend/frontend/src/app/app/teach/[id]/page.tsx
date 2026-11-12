"use client";

import { use, useCallback, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, EmptyState, Pill, Progress, ScreenSkeleton, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { CourseEditor, problemsFor } from "@/components/ux/teach/CourseEditor";
import { CoursePreview } from "@/components/ux/teach/CoursePreview";
import { CourseQA } from "@/components/ux/learning/CourseQA";
import {
  apiConfirmLearnerPayment, apiDeclineLearnerPayment, apiSaveCourse, apiSetCourseLive, apiTeachCourse, apiTeachLearners,
  rupees, type CourseInput, type TeachCourse, type TeachLearner,
} from "@/lib/teach-api";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";

const TABS = ["Course", "Learners", "Questions"];

/**
 * One of her courses: edit it, put it live or take it down, and — on a paid
 * course — confirm the payments learners say they have made.
 */
export default function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: course, source, refetch } = useResource(
    useCallback((s: AbortSignal) => apiTeachCourse(id, s).catch(() => null), [id]),
    null as TeachCourse | null,
  );
  const { data: learners, refetch: refetchLearners } = useResource(
    useCallback((s: AbortSignal) => apiTeachLearners(id, s).catch(() => []), [id]),
    [] as TeachLearner[],
  );

  const [tab, setTab] = useState("Course");
  const [notice, setNotice] = useState("");
  // ?tab=learners from Teach and from her notifications; ?created= after publishing.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => {
      if (q.get("tab") === "learners") setTab("Learners");
      const made = q.get("created");
      if (made) setNotice(made === "live" ? "Your course is live in Learn." : "Saved as a draft — publish it when you are ready.");
    });
    return () => window.clearTimeout(t);
  }, []);

  const [form, setForm] = useState<CourseInput | null>(null);
  const [paid, setPaid] = useState(false);
  const [tried, setTried] = useState(false);
  // The form starts from the saved course, once it has loaded.
  useEffect(() => {
    if (!course || form) return;
    const t = window.setTimeout(() => {
      setForm({
        name: course.name, desc: course.desc, category: course.category, duration: course.duration,
        price_rupees: Math.round(course.price_minor / 100), upi_id: course.upi_id,
        lessons: course.lessons.length ? course.lessons : [{ title: "", detail: "", duration: "", body: "", video_url: "", preview: false }],
        cover: course.cover ?? "",
        publish: course.live,
      });
      setPaid(course.price_minor > 0);
    });
    return () => window.clearTimeout(t);
  }, [course, form]);

  const input: CourseInput | null = form && { ...form, price_rupees: paid ? form.price_rupees : 0, upi_id: paid ? form.upi_id : "" };
  const problems = input ? problemsFor(input, paid) : {};

  const save = useAction(
    async () => {
      if (!input || !course) return;
      await apiSaveCourse(id, { ...input, publish: course.live });
    },
    { onDone: () => { setNotice("Saved."); refetch(); }, fallbackError: "Your changes did not save. Try again in a moment." },
  );
  const live = useAction(
    async (on: boolean) => { await apiSetCourseLive(id, on); },
    { onDone: () => { refetch(); }, fallbackError: "That did not go through. Try again in a moment." },
  );
  const confirm = useAction(
    async (enrollmentId: string) => { await apiConfirmLearnerPayment(enrollmentId); },
    { onDone: () => { refetchLearners(); refetch(); }, fallbackError: "That did not go through. Try again in a moment." },
  );
  const decline = useAction(
    async (enrollmentId: string) => { await apiDeclineLearnerPayment(enrollmentId); },
    { onDone: () => { refetchLearners(); refetch(); }, fallbackError: "That did not go through. Try again in a moment." },
  );

  if (!course && source === "loading") return <HomeShell skeleton="list"><ScreenSkeleton shape="list" /></HomeShell>;
  if (!course) {
    return (
      <HomeShell>
        <Card>
          <EmptyState icon="SearchX" title="That course isn't one of yours" body="It may have been removed."
                      action={<Btn href="/app/teach" variant="primary" iconEnd="ArrowRight">My courses</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  const hidden = course.status === "Archived";
  const toConfirm = learners.filter((l) => l.status === "pending" && l.payment_status === "claimed").length;

  return (
    <HomeShell rail={tab === "Course" && form ? <CoursePreview value={form} paid={paid} /> : undefined}>
      <Back to="/app/teach" label="My courses" className="mb-4" />
      <ScreenHead
        title={course.name}
        sub={`${course.category} · ${course.lesson_count} lessons · ${course.price_minor ? rupees(course.price_minor) : "Free"}`}
      >
        <div className="flex flex-wrap gap-2">
          <Btn href={`/app/programs/${id}`} variant="outline" icon="Eye">See it as a learner</Btn>
          {!hidden && (course.live
            ? <Btn variant="outline" icon="EyeOff" loading={live.busy} onClick={() => void live.run(false)}>Take it down</Btn>
            : <Btn variant="primary" icon="Send" loading={live.busy} onClick={() => void live.run(true)}>Publish</Btn>)}
        </div>
      </ScreenHead>

      {(notice || hidden || live.error) && (
        <Card className="mb-[16px]" style={{ background: hidden || live.error ? "var(--ux-tint-orange)" : "var(--ux-tint-green)" }}>
          <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
            {hidden ? <Icons.EyeOff className="h-4 w-4" /> : <Icons.CheckCircle2 className="h-4 w-4" style={{ color: "var(--ux-green-ink)" }} />}
            {hidden ? "Our team has hidden this course. Write to us through Help to talk about it." : live.error || notice}
          </p>
        </Card>
      )}

      <div className="mb-[16px] grid grid-cols-2 gap-[12px] lg:grid-cols-4">
        {([
          ["Status", hidden ? "Hidden" : course.live ? "Live" : "Draft"],
          ["Learning", String(course.stats.learning)],
          ["Finished", String(course.stats.completed)],
          [course.price_minor ? "Earned" : "Waiting to pay", course.price_minor ? rupees(course.stats.earned_minor) : String(course.stats.pending)],
        ] as const).map(([k, v]) => (
          <Card key={k}>
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{k}</p>
          </Card>
        ))}
      </div>

      <div className="mb-[16px]">
        <Tabs items={TABS.map((t) => (t === "Learners" && toConfirm ? `Learners (${toConfirm})` : t))}
              active={tab === "Learners" && toConfirm ? `Learners (${toConfirm})` : tab}
              onChange={(t) => setTab(t.startsWith("Learners") ? "Learners" : t)} />
      </div>

      {tab === "Course" && form && (
        <>
          <CourseEditor value={form} onChange={setForm} paid={paid} onPaid={setPaid} problems={tried ? problems : {}} />
          <Card className="mt-[16px]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs" style={{ color: tried && Object.keys(problems).length ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
                {tried && Object.keys(problems).length
                  ? "A few things need fixing — they are marked above."
                  : course.live ? "Changes show in Learn as soon as you save." : "It stays a draft until you publish it."}
              </p>
              <Btn variant="primary" icon="Save" loading={save.busy}
                   onClick={() => { setTried(true); if (!Object.keys(problems).length) void save.run(); }}>
                Save changes
              </Btn>
            </div>
            {save.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{save.error}</p>}
          </Card>
        </>
      )}

      {tab === "Learners" && (
        learners.length === 0 ? (
          <Card>
            <EmptyState icon="Users" title="No learners yet"
                        body={course.live ? "Share your course with friends and in your groups — learners appear here." : "Publish your course so members can find it in Learn."} />
          </Card>
        ) : (
          <div className="space-y-[12px]">
            {(confirm.error || decline.error) && (
              <p role="alert" className="text-xs" style={{ color: "var(--ux-danger-ink)" }}>{confirm.error || decline.error}</p>
            )}
            {learners.map((l) => (
              <Card key={l.enrollment_id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-sm font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                    {l.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{l.name}</p>
                      {l.status === "pending"
                        ? <Pill tone="orange" size="sm">{l.payment_status === "claimed" ? "Says she paid" : "Not paid yet"}</Pill>
                        : l.status === "completed" ? <Pill tone="green" size="sm">Finished</Pill> : <Pill tone="blue" size="sm">Learning</Pill>}
                    </div>
                    {l.status === "pending" ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                        {l.payment_status === "claimed"
                          ? `${rupees(l.amount_minor)} by UPI${l.reference ? ` · reference ${l.reference}` : ""}. Check your UPI app before confirming.`
                          : `Asked to join on ${l.joined}. She sees your UPI ID and pays you ${rupees(l.amount_minor)}.`}
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-full max-w-[260px]"><Progress pct={l.progress} track="--ux-track" /></div>
                        <span className="text-xs tabular-nums" style={{ color: "var(--ux-muted)" }}>{l.progress}%</span>
                      </div>
                    )}
                  </div>
                  {l.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Btn variant="outline" size="sm" loading={decline.busyWith === l.enrollment_id}
                           onClick={() => void decline.run(l.enrollment_id)}>Not received</Btn>
                      <Btn variant="primary" size="sm" icon="Check" loading={confirm.busyWith === l.enrollment_id}
                           onClick={() => void confirm.run(l.enrollment_id)}>
                        Payment received
                      </Btn>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "Questions" && <CourseQA programId={id} lessonCount={course.lesson_count} />}
    </HomeShell>
  );
}
