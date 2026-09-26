"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardFrame } from "@/components/ux/onboard/Frame";
import { Btn, IconTile } from "@/components/ux/kit";
import { phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";
import { apiGetSession } from "@/lib/api";
import { apiFinishOnboarding, apiFinishStep } from "@/lib/theme-api";
import { useAuth } from "@/context/AuthContext";

const SLIDES = [
  {
    eyebrow: "Home & Sakhi", title: "Know what needs you today",
    body: "Home gathers the most useful next actions, recommendations, schedule and reminders. Ask Sakhi when you want help finding or understanding anything.",
    path: "Home → Today’s plan", image: "/ux/art/onboarding-all-ages-v2.webp", imageAlt: "Girls and women of every age learning, creating and supporting each other",
    outcome: "A simple plan for today, shaped around you",
    features: [["Home", "Open Home", "Start with the cards marked for today."], ["CheckCircle2", "Complete one action", "The app updates your journey and recommendations."], ["Bot", "Ask Sakhi", "Use your own words when you are unsure where to go."]],
  },
  {
    eyebrow: "Learn", title: "Build skills at your own pace",
    body: "Learn includes courses, mentors, skill assessments, certificates and simple phone guidance. Your place is saved automatically.",
    path: "Learn → Choose a course", image: "/ux/art/onboarding-learn-v2.webp", imageAlt: "Women learning practical and business skills together",
    outcome: "One useful skill you can practise immediately",
    features: [["Search", "Choose", "Pick a course or mentor that matches your goal."], ["PlayCircle", "Practice", "Finish one short lesson whenever you have time."], ["Award", "Show progress", "Complete an assessment and keep your certificate."]],
  },
  {
    eyebrow: "Work", title: "Find work and follow every application",
    body: "Create your skills profile, check trustworthy opportunities, apply without repeating details, and see exactly where each application stands.",
    path: "Work → Find work", image: "/ux/art/onboarding-work-v2.webp", imageAlt: "Women planning and finding suitable work opportunities",
    outcome: "A trustworthy opportunity and a trackable application",
    features: [["FileText", "Tell us your skills", "Add what you can do once in your work profile."], ["BadgeCheck", "Check the opportunity", "Review trust and payment information before applying."], ["ClipboardList", "Track the result", "Follow submitted, shortlisted and completed work."]],
  },
  {
    eyebrow: "Earn & Money", title: "Sell, get paid and know where money went",
    body: "Build your shop, list products or services, manage orders, collect payments, track earnings and move money to your bank.",
    path: "Earn → Your shop", image: "/ux/art/onboarding-earn-v2.webp", imageAlt: "Women running craft, food and digital businesses",
    outcome: "A ready-to-share listing and a clear money trail",
    features: [["Store", "Add what you sell", "Use guided choices, photos, price and availability."], ["ShoppingBasket", "Handle the order", "Confirm, prepare and update the buyer at each stage."], ["Wallet", "Track and withdraw", "See each rupee, statements and bank withdrawals."]],
  },
  {
    eyebrow: "Circle", title: "Grow with women you trust",
    body: "Join or start circles, message members, attend events, save together and exchange help, skills and useful items.",
    path: "Circle → Explore circles", image: "/ux/art/onboarding-circle-v2.webp", imageAlt: "A welcoming circle of women sharing ideas",
    outcome: "A trusted group and one meaningful next action",
    features: [["UsersRound", "Find your circle", "Browse by purpose, place or shared interest."], ["MessageCircle", "Take part", "Join conversations, events and group activities."], ["HeartHandshake", "Help each other", "Teach, learn, save or complete a task together."]],
  },
  {
    eyebrow: "Health & Wellness", title: "Private care for every life stage",
    body: "Use optional cycle tracking, mood and symptom check-ins, nutrition, mental wellness, gentle workouts and trusted health guidance.",
    path: "Health & Wellness → Today", image: "/ux/art/onboarding-wellbeing-all-ages-v2.webp", imageAlt: "Girls and women across life stages following calm wellbeing routines",
    outcome: "Private guidance that follows your choices and routine",
    features: [["HeartPulse", "Check in", "Log only what you choose with quick one-tap options."], ["Sparkles", "See your guidance", "Get relevant care, food, rest and wellbeing suggestions."], ["BellRing", "Set reminders", "Choose when the app should remind you and when it should stay quiet."]],
  },
  {
    eyebrow: "Help, Rights & Safety", title: "Reach the right help quickly",
    body: "Help brings together support, safety contacts, money-scam guidance, rights, family records and important documents. Urgent actions stay easy to find.",
    path: "Help → Choose what happened", image: "/ux/art/onboarding-help-safety-v2.webp", imageAlt: "Two women providing calm and trusted support",
    outcome: "The right support route without searching or repeating yourself",
    features: [["LifeBuoy", "Choose the problem", "Start with plain options instead of explaining everything."], ["ShieldAlert", "Use urgent help", "Open trusted safety contacts and actions quickly."], ["Lock", "Keep proof private", "Store important papers securely and control who sees them."]],
  },
] as const;

export default function ProductTour({ mode }: { mode: "member" | "public" }) {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [activeFeature, setActiveFeature] = useState(0);
  const replay = mode === "member" && user?.onboarding_complete !== false;

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("step"));
    if (requested >= 1 && requested <= SLIDES.length) setStep(requested);
  }, []);

  const slide = SLIDES[step - 1];

  function goTo(nextStep: number) {
    setDirection(nextStep < step ? "back" : "forward");
    setProblem("");
    setActiveFeature(0);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    if (mode === "public") { router.push("/signup"); return; }
    if (replay) { router.replace("/app"); return; }
    setWorking(true);
    setProblem("");
    try {
      await apiFinishOnboarding();
      const fresh = await apiGetSession();
      if (fresh) updateUser(fresh);
      router.replace("/app");
    } catch {
      setProblem("We could not save your progress. Check your connection and try again.");
      setWorking(false);
    }
  }

  async function next() {
    if (step === SLIDES.length) { await finish(); return; }
    if (mode === "member" && !replay) void apiFinishStep(`tour-${step}`).catch(() => undefined);
    goTo(step + 1);
  }

  return (
    <>
      <span className="sr-only" aria-live="polite">{`${slide.eyebrow}. Step ${step} of ${SLIDES.length}.`}</span>
      <OnboardFrame step={step} total={SLIDES.length} title={slide.title} sub={slide.body}
      motionKey={step} motionDirection={direction}
      onBack={step > 1 ? () => goTo(step - 1) : undefined}
      backTo={step > 1 ? SLIDES[step - 2].eyebrow : undefined}
      footer={<div>
        {problem && <p role="alert" className="mb-3 rounded-xl p-3 text-xsm" style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>{problem}</p>}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {mode === "public"
            ? <Btn href="/signin" variant="ghost" className={phoneSecondary}>I already have an account</Btn>
            : <button type="button" disabled={working} onClick={() => void finish()} className="min-h-[44px] px-3 text-xsm font-semibold" style={{ color: "var(--ux-muted)" }}>{replay ? "Exit tour" : "Skip for now"}</button>}
          <Btn variant="primary" className={phonePrimary} disabled={working} iconEnd={working ? undefined : "ArrowRight"} onClick={() => void next()}>
            {working ? "Opening…" : step === SLIDES.length ? (mode === "public" ? "Create my account" : replay ? "Back to WomSakhi" : "Start using WomSakhi") : "Next"}
          </Btn>
        </div>
      </div>}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--ux-brand)" }}>{slide.eyebrow}</p>
        <span className="rounded-full px-3 py-1 text-2xs font-semibold" style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{slide.path}</span>
      </div>
      <section className="ux-tour-stage ux-sq -mx-4 overflow-hidden rounded-none border-x-0 border-y sm:mx-0 sm:rounded-[24px] sm:border" style={{ borderColor: "var(--ux-line)", background: "linear-gradient(145deg, var(--ux-tint-pink), var(--ux-tint-lilac))" }}>
        <div className="grid lg:grid-cols-[minmax(0,1.18fr)_minmax(300px,.82fr)]">
          <div className="ux-tour-art-frame relative min-h-[180px] overflow-hidden sm:min-h-[270px] lg:min-h-[360px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt={slide.imageAlt} className="absolute inset-0 h-full w-full object-cover object-center" decoding="async" fetchPriority={step === 1 ? "high" : "auto"} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
              <div><p className="text-2xs font-bold uppercase tracking-[0.16em] text-white/75">Start here</p><p className="mt-1 text-sm font-semibold">{slide.path}</p></div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-white/20 backdrop-blur" aria-hidden="true">→</span>
            </div>
          </div>

          <div className="ux-tour-guide p-4 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ux-brand)" }}>Your first few minutes</p>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-2xs font-bold" style={{ color: "var(--ux-brand)" }}>3 steps</span>
            </div>
            <div className="ux-tour-steps relative mt-3" role="group" aria-label={`How to use ${slide.eyebrow}`}>
              <div className="ux-tour-steps-line absolute bottom-5 start-5 top-5 w-px" style={{ background: "var(--ux-line)" }} aria-hidden="true" />
              {slide.features.map(([icon, title, note], index) => {
                const selected = activeFeature === index;
                return (
                  <button key={title} type="button" aria-pressed={selected} onClick={() => setActiveFeature(index)}
                    className="ux-tour-step ux-press relative mb-2 flex min-h-[66px] w-full items-center gap-3 rounded-[16px] border p-2.5 text-start transition last:mb-0"
                    style={{ borderColor: selected ? "var(--ux-brand)" : "transparent", background: selected ? "var(--ux-surface)" : "transparent", boxShadow: selected ? "0 10px 28px -20px var(--ux-brand)" : "none" }}>
                    <div className="ux-tour-step-icon relative z-[1] shrink-0"><IconTile icon={icon} tint={selected ? "--ux-brand-tint" : "--ux-surface"} ink="--ux-brand" size={40} radius={12} /><span className="absolute -end-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: "var(--ux-brand)" }}>{index + 1}</span></div>
                    <div className="min-w-0"><p className="ux-tour-step-title text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{title}</p><p className="ux-tour-step-note mt-0.5 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{note}</p></div>
                  </button>
                );
              })}
            </div>
            <div className="ux-tour-mobile-detail mt-3 rounded-[16px] border p-3 sm:hidden" style={{ borderColor: "var(--ux-line)", background: "color-mix(in srgb, var(--ux-surface) 88%, transparent)" }} aria-live="polite">
              <p className="text-xsm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{slide.features[activeFeature][2]}</p>
              <p className="mt-2 flex items-start gap-2 text-xs leading-snug" style={{ color: "var(--ux-green-ink)" }}><span aria-hidden="true">✓</span>{slide.outcome}</p>
            </div>
            <div className="ux-tour-result mt-3 hidden rounded-[16px] border p-3 sm:block" style={{ borderColor: "var(--ux-line)", background: "color-mix(in srgb, var(--ux-surface) 82%, transparent)" }}>
              <p className="text-2xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ux-green-ink)" }}>Your first result</p>
              <p className="mt-1 text-xsm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{slide.outcome}</p>
            </div>
          </div>
        </div>
      </section>
      <nav aria-label="Tour sections" className="ux-tour-nav -mx-2 mt-3 flex snap-x gap-1 overflow-x-auto px-2 pb-1">
        {SLIDES.map((item, index) => <button key={item.eyebrow} type="button" aria-label={`Open ${item.eyebrow}`} aria-current={step === index + 1 ? "step" : undefined} onClick={() => goTo(index + 1)} className="ux-press flex h-[44px] shrink-0 snap-center items-center gap-2 rounded-full px-3 text-xs font-semibold" style={{ background: step === index + 1 ? "var(--ux-brand)" : "var(--ux-surface)", color: step === index + 1 ? "white" : "var(--ux-muted)", border: "1px solid var(--ux-line)" }}><span className="h-2 w-2 rounded-full" style={{ background: step === index + 1 ? "white" : "var(--ux-track)" }} />{item.eyebrow}</button>)}
      </nav>
      </OnboardFrame>
    </>
  );
}
