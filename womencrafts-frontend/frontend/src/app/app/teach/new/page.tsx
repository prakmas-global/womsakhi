"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Back, Btn, Card } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { CourseEditor, EMPTY_COURSE, problemsFor } from "@/components/ux/teach/CourseEditor";
import { CoursePreview } from "@/components/ux/teach/CoursePreview";
import { apiCreateCourse, type CourseInput } from "@/lib/teach-api";
import { useAction } from "@/lib/use-action";

/** A new course: the form, then "Publish" (live in Learn) or "Save as draft". */
export default function NewCoursePage() {
  const router = useRouter();
  const [course, setCourse] = useState<CourseInput>(EMPTY_COURSE);
  const [paid, setPaid] = useState(false);
  const [tried, setTried] = useState(false);
  const input: CourseInput = { ...course, price_rupees: paid ? course.price_rupees : 0, upi_id: paid ? course.upi_id : "" };
  const problems = problemsFor(input, paid);

  const save = useAction(
    async (publish: boolean) => {
      const made = await apiCreateCourse({ ...input, publish });
      router.push(`/app/teach/${made.id}?created=${publish ? "live" : "draft"}`);
    },
    { fallbackError: "Your course did not save. Check your connection and try again." },
  );
  const submit = (publish: boolean) => {
    setTried(true);
    if (Object.keys(problems).length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    void save.run(publish);
  };

  return (
    <HomeShell rail={<CoursePreview value={input} paid={paid} />}>
      <Back to="/app/teach" label="My courses" className="mb-4" />
      <ScreenHead title="New course" sub="Write it once — learners can start the moment you publish." />
      <CourseEditor value={course} onChange={setCourse} paid={paid} onPaid={setPaid} problems={tried ? problems : {}} />
      <Card className="mt-[16px]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs" style={{ color: tried && Object.keys(problems).length ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
            {tried && Object.keys(problems).length
              ? "A few things need fixing — they are marked above."
              : "Publishing puts it in Learn for every member. You can edit it any time."}
          </p>
          <div className="flex gap-2">
            <Btn variant="outline" disabled={save.busy} onClick={() => submit(false)}>Save as draft</Btn>
            <Btn variant="primary" icon="Send" loading={save.busy} onClick={() => submit(true)}>Publish course</Btn>
          </div>
        </div>
        {save.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{save.error}</p>}
      </Card>
    </HomeShell>
  );
}
