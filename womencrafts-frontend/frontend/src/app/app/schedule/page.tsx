"use client";
import Link from "next/link";
import { useT, type MessageKey } from "@/i18n";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {HomeShell} from "@/components/ux/home/HomeShell";
import {I} from "@/components/ux/kit";
import s from "./schedule.module.css";
import { useResource } from "@/lib/use-resource";
import { apiWeek, type Cat, type Week, type WeekItem } from "@/lib/week-api";
import { apiMyBookings, type Booking } from "@/lib/member-api";
import { apiListReminders, type Reminder } from "@/lib/engines-api";

/**
 * Her calendar.
 *
 * ── Everything here is hers ─────────────────────────────────────────────────
 * This screen used to be twenty invented activities on a frozen week: a
 * "UI/UX Course" on Monday, yoga at four, a "Career counselling with Ananya"
 * booking she had never made — the same for every woman, and pinned to the
 * 13th–19th of September 2026 whatever the date really was. The column marked
 * "today" was almost never today, which on a calendar is not a cosmetic bug:
 * it is the one thing the screen exists to get right.
 *
 * Now the grid, the month, the day numbers and "today" all come from the real
 * week, and the only things drawn on it are sessions she booked and events she
 * registered for.
 *
 * ── Empty is a real answer ──────────────────────────────────────────────────
 * A woman with nothing on this week sees nothing on this week, and is offered
 * the three places something could come from. Filling her calendar with
 * examples so it looks alive is how she ends up missing the one appointment
 * that was real.
 */

type Module="calendar"|"agenda"|"bookings"|"reminders"|"focus";
const cats:[Cat,string,string][]=[["learning","Learning","GraduationCap"],["work","Work","Briefcase"],["health","Health","HeartPulse"],["community","Community","Users"],["personal","Personal","Sparkles"],["money","Money","Wallet"],["mentoring","Mentoring","UserRound"]];
const hours=["6 AM","7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM","9 PM"];
const moduleTabs:[Module,string,string][]=[["calendar","Calendar","CalendarDays"],["agenda","Agenda","List"],["bookings","My bookings","BookOpenCheck"],["reminders","Reminders","Bell"],["focus","Focus time","Clock3"]];

/** The grid starts at 6 AM and each row is 49px. */
const GRID_START = 6, ROW = 49;

/**
 * Focus blocks. These are a tool she starts, not a record of anything, so
 * they are the one part of this screen that is legitimately not fetched —
 * and the timer below actually runs rather than pretending to.
 */
const FOCUS=[["Quick focus","25 minutes · Short task","Timer","personal",25],["Deep work","50 minutes · One meaningful task","Brain","work",50],["Learning block","40 minutes · Course or practice","GraduationCap","learning",40]] as const;

const EMPTY_WEEK: Week = { start: "", days: [], items: [], count: 0, untimed: 0 };

export default function Schedule(){
  const tr = useT();
  const [view,setView]=useState("week");
  const [module,setModule]=useState<Module>("calendar");
  const [off,setOff]=useState<Cat[]>([]);
  const [add,setAdd]=useState(false);
  /** Which week, as an offset from this one. 0 is the week containing today. */
  const [weekOff,setWeekOff]=useState(0);
  const [focusFor,setFocusFor]=useState<number|null>(null);

  const startISO = useMemo(()=>{
    const d = new Date();
    d.setDate(d.getDate() + weekOff * 7);
    return d.toISOString().slice(0,10);
  },[weekOff]);

  const week = useResource<Week>(
    useCallback((sig)=>apiWeek(startISO,sig),[startISO]),
    EMPTY_WEEK,
  );
  const bookings = useResource<Booking[]>(
    useCallback(()=>apiMyBookings("upcoming").catch(()=>[]),[]),
    [],
  );
  const reminders = useResource<Reminder[]>(
    useCallback(()=>apiListReminders().catch(()=>[]),[]),
    [],
  );

  const days = week.data.days;
  // The day she is looking at. Defaults to today when today is in this week,
  // and to the first day when it is not — never to a fixed index.
  const todayIdx = Math.max(0, days.findIndex(d=>d.today));
  const [picked,setPicked]=useState<number|null>(null);
  const selected = picked ?? todayIdx;

  const shown=useMemo(()=>week.data.items.filter(e=>!off.includes(e.category)),[off,week.data.items]);
  const onSelected=shown.filter(e=>e.date===days[selected]?.date);
  const timed=shown.filter(e=>e.hour!==null);
  const untimed=shown.filter(e=>e.hour===null);
  const toggle=(c:Cat)=>setOff(x=>x.includes(c)?x.filter(v=>v!==c):[...x,c]);

  const monthLabel = useMemo(()=>{
    if(!days.length) return "";
    const first=new Date(days[0].date), last=new Date(days[6].date);
    const f=first.toLocaleDateString("en-IN",{month:"long"});
    const l=last.toLocaleDateString("en-IN",{month:"long"});
    // A week can straddle two months, and saying only one of them is wrong.
    return f===l ? `${f} ${first.getFullYear()}` : `${f} – ${l} ${last.getFullYear()}`;
  },[days]);

  const selectedLabel = days[selected]
    ? new Date(days[selected].date).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})
    : "";

  const rail=<div className={s.rail}>
    <section className={s.mini}>
      <header><h2>{monthLabel}</h2><div>
        <button aria-label={tr("schedule.previousMonth")} onClick={()=>{setWeekOff(w=>w-1);setPicked(null);}}><I name="ChevronLeft"/></button>
        <button aria-label={tr("schedule.nextMonth")} onClick={()=>{setWeekOff(w=>w+1);setPicked(null);}}><I name="ChevronRight"/></button>
      </div></header>
      <div className={s.miniWeek}>{["S","M","T","W","T","F","S"].map((x,i)=><b key={i}>{x}</b>)}</div>
      <div className={s.miniDays}>{days.map((d,i)=>
        <button className={d.today?s.today:""} key={d.date} onClick={()=>setPicked(i)}>{d.day}</button>)}</div>
      <div className={s.todayList}>
        <header><h3>{selectedLabel}</h3><span>{onSelected.length} {onSelected.length===1?"activity":"activities"}</span></header>
        {onSelected.length===0
          ? <p className={s.railEmpty}>Nothing on this day.</p>
          : onSelected.map((e)=>
            <Link href={e.href} className={s.todayItem} data-cat={e.category} key={e.id}>
              <span>{e.time.split(" - ")[0]}</span><i><I name={e.icon}/></i>
              <b>{e.title}<small>{e.category}{e.where?` · ${e.where}`:""}</small></b>
            </Link>)}
        <button onClick={()=>{setView("list");setModule("agenda");}} className={s.full}>{tr("calendar.viewFullDay")} <I name="ArrowRight"/></button>
      </div>
    </section>
    <blockquote className={s.quote}>{tr("schedule.wellPlannedDays")}<br/>{tr("schedule.leadToAHappierYou")}<cite>— WomSakhi</cite></blockquote>
    <section className={s.quick}><h3>{tr("schedule.quickAdd")}</h3>
      <div>{([["CalendarPlus","Event","/app/events"],["Bell","Reminder","/app/reminders"],["ListChecks","Task","/app/goals"],["Target","Goal","/app/goals"]] as const).map(x=>
        <Link href={x[2]} key={x[1]}><i><I name={x[0]}/></i>{x[1]}</Link>)}</div>
    </section>
  </div>;

  return <HomeShell active="/app/schedule" rail={rail}><main className={s.page}>
    <section className={s.hero}><Image src="/ux/schedule/calendar-hero-v1.png" alt={tr("schedule.womanEnjoyingACalmMomentWhile")} fill priority sizes="(max-width: 760px) 100vw, 75vw"/><div className={s.shade}/><div className={s.heroCopy}><p>← Home&nbsp; / &nbsp;<b>{tr("schedule.yourCalendar2")}</b></p><h1>Your <em>Calendar</em></h1><span>{tr("schedule.planYourTimeStayConsistentAnd")}</span></div><p className={s.note}>A balanced<br/>{tr("schedule.youBuilds")}<br/>a brighter<br/>tomorrow ♥<small>— WomSakhi</small></p></section>

    <nav className={s.nav}>{moduleTabs.map(([id,label,icon])=><button className={module===id?s.active:""} aria-pressed={module===id} onClick={()=>{setModule(id);if(id==="agenda")setView("list");if(id==="calendar"&&view==="list")setView("week")}} key={id}><I name={icon}/>{label}</button>)}
      <div className={s.add}><button onClick={()=>setAdd(!add)}><I name="Plus"/> {tr("schedule.addActivity")}</button>{add&&<div>{[["Book a mentor","/app/mentors"],["Join an event","/app/events"],["Start a course","/app/programs"]].map(x=><Link key={x[1]} href={x[1]}>{x[0]}<I name="ArrowRight"/></Link>)}</div>}</div>
    </nav>

    {(module==="calendar"||module==="agenda")&&<>
      <section className={s.controls}>
        <div>
          <button onClick={()=>{setWeekOff(0);setPicked(null);}}>Today</button>
          <button aria-label={tr("schedule.previousWeek")} onClick={()=>{setWeekOff(w=>w-1);setPicked(null);}}><I name="ChevronLeft"/></button>
          <button aria-label={tr("schedule.nextWeek")} onClick={()=>{setWeekOff(w=>w+1);setPicked(null);}}><I name="ChevronRight"/></button>
          <h2>{monthLabel}</h2>
        </div>
        <div className={s.switch}>{["day","week","month","list"].map(x=><button aria-pressed={view===x} onClick={()=>{setView(x);setModule(x==="list"?"agenda":"calendar")}} key={x}>{x}</button>)}</div>
      </section>

      <div className={s.filters}><button className={!off.length?s.on:""} onClick={()=>setOff([])}>All</button>{cats.map(c=><button data-cat={c[0]} aria-pressed={!off.includes(c[0])} onClick={()=>toggle(c[0])} key={c[0]}><I name={c[2]}/>{c[1]}</button>)}</div>

      {view==="week"||view==="day"?<>
        <section className={s.week}>
          <div className={s.corner}/>
          {days.map((d,i)=><button className={`${s.dayHead} ${selected===i?s.selected:""}`} onClick={()=>setPicked(i)} key={d.date}><span>{d.label}</span><b>{d.day}</b></button>)}
          <div className={s.times}>{hours.map(x=><span key={x}>{x}</span>)}</div>
          <div className={s.grid}>{days.map((d,di)=>
            <div className={`${s.col} ${selected===di?s.selectedCol:""}`} key={d.date}>
              {timed.filter(e=>e.date===d.date).map((e)=>
                <Link href={e.href} className={s.event} data-cat={e.category}
                      style={{top:Math.max(0,((e.hour as number)-GRID_START)*ROW),height:Math.max(47,e.hours*ROW)}} key={e.id}>
                  <b><I name={e.icon}/>{e.title}</b><small>{e.time}</small>
                </Link>)}
            </div>)}
          </div>
        </section>
        {/* Anything whose time could not be read is listed rather than drawn
            at a guessed hour — and never silently dropped. */}
        {untimed.length>0&&<section className={s.list}>
          <header><h2>No time set</h2><span>{untimed.length}</span></header>
          {untimed.map((e)=><Link href={e.href} key={e.id}><i data-cat={e.category}><I name={e.icon}/></i><span><b>{e.title}</b><small>{new Date(e.date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</small></span><I name="ChevronRight"/></Link>)}
        </section>}
        {week.source!=="loading"&&shown.length===0&&<section className={s.list}>
          <header><h2>Nothing this week</h2><span>0</span></header>
          <p className={s.emptyBody}>Sessions you book and events you join appear here. Nothing is put on your calendar that you did not agree to.</p>
          <div className={s.emptyActions}>
            <Link href="/app/mentors">Book a mentor<I name="ArrowRight"/></Link>
            <Link href="/app/events">Join an event<I name="ArrowRight"/></Link>
            <Link href="/app/programs">Start a course<I name="ArrowRight"/></Link>
          </div>
        </section>}
      </>:<section className={s.list}>
        <header><h2>{view==="month"?monthLabel:"Your agenda"}</h2><span>{shown.length} planned {shown.length===1?"activity":"activities"}</span></header>
        {shown.length===0
          ? <p className={s.emptyBody}>Nothing on this week yet.</p>
          : shown.map((e)=><Link href={e.href} key={e.id}><i data-cat={e.category}><I name={e.icon}/></i><span><b>{e.title}</b><small>{new Date(e.date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})} · {e.time}</small></span><I name="ChevronRight"/></Link>)}
      </section>}
    </>}

    {module==="bookings"&&<section className={s.modulePanel}>
      <header><div><span><I name="BookOpenCheck"/></span><div><h2>My bookings</h2><p>Your confirmed sessions and upcoming reservations.</p></div></div>
        <Link className={s.panelBtn} href="/app/mentors"><I name="Plus"/> New booking</Link></header>
      <div className={s.moduleCards}>
        {bookings.data.length===0
          ? <p className={s.emptyBody}>You have no sessions booked. When you book one, it shows here and on your calendar.</p>
          : bookings.data.map((b)=>
            <article data-cat={b.with_whom?"mentoring":"learning"} key={b.id}>
              <i><I name={b.with_whom?"UserRound":"GraduationCap"}/></i>
              <div><h3>{b.service_name}</h3>
                <p>{new Date(b.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · {b.time}{b.mode?` · ${b.mode}`:""}</p>
                <span>{b.status === "upcoming" ? "Confirmed" : b.status}</span></div>
              <Link href={`/app/bookings/${b.id}`}>View booking <I name="ArrowRight"/></Link>
            </article>)}
      </div>
    </section>}

    {module==="reminders"&&<section className={s.modulePanel}>
      <header><div><span><I name="Bell"/></span><div><h2>Reminders</h2><p>Small prompts that keep important plans from slipping away.</p></div></div>
        <Link className={s.panelBtn} href="/app/reminders"><I name="Plus"/> Add reminder</Link></header>
      <div className={s.moduleCards}>
        {reminders.data.length===0
          ? <p className={s.emptyBody}>You have no reminders set.</p>
          : reminders.data.map((r)=>
            <article data-cat={r.category||"personal"} key={r.id}>
              <i><I name="Bell"/></i>
              {/* `title_key` is a catalogue key, not a sentence — the same
                  cast the nudge components use. */}
              <div><h3>{tr(r.title_key as MessageKey)}</h3><p>{scheduleWords(r)}</p>
                <span>{r.state==="active"?"Active":r.state}</span></div>
              <Link href="/app/reminders">Edit reminder <I name="ArrowRight"/></Link>
            </article>)}
      </div>
    </section>}

    {module==="focus"&&<section className={s.modulePanel}>
      <header><div><span><I name="Clock3"/></span><div><h2>Focus time</h2><p>Protect a quiet block for the work that matters most.</p></div></div></header>
      <div className={s.moduleCards}>
        {FOCUS.map((f)=>
          <article data-cat={f[3]} key={f[0]}>
            <i><I name={f[2]}/></i>
            <div><h3>{f[0]}</h3><p>{f[1]}</p>
              <span>{focusFor===f[4]?"Running":"Ready"}</span></div>
            <button onClick={()=>setFocusFor(focusFor===f[4]?null:f[4])}>
              {focusFor===f[4]?"Stop":`Start ${f[4]} min`} <I name="ArrowRight"/>
            </button>
          </article>)}
      </div>
      {focusFor!==null&&<FocusTimer minutes={focusFor} onDone={()=>setFocusFor(null)}/>}
    </section>}
  </main></HomeShell>
}

/**
 * A timer that actually runs.
 *
 * The three focus buttons used to say "Start 25 min" and do nothing at all.
 * This is the smallest honest version: it counts down, it says how long is
 * left, and stopping it stops it.
 */
function FocusTimer({minutes,onDone}:{minutes:number;onDone:()=>void}){
  const [left,setLeft]=useState(minutes*60);

  // Restart whenever she picks a different block.
  useEffect(()=>{setLeft(minutes*60);},[minutes]);

  useEffect(()=>{
    // `setInterval` inside an effect, so React clears it when she stops the
    // timer, switches tab or leaves the screen. A `useMemo` cannot do this —
    // it has no cleanup, so the interval would keep firing forever.
    const id=setInterval(()=>{
      setLeft((n)=>{
        if(n<=1){ onDone(); return 0; }
        return n-1;
      });
    },1000);
    return ()=>clearInterval(id);
  },[minutes,onDone]);

  const mm=String(Math.floor(left/60)).padStart(2,"0");
  const ss=String(left%60).padStart(2,"0");
  return <p className={s.focusTimer} role="timer" aria-live="polite">{mm}:{ss} left</p>;
}

/**
 * How often a reminder fires, in words.
 *
 * The three schedule types are `once`, `recurring` and `event_relative`; a
 * recurring one carries the days it repeats on, with 0 = Monday to match
 * Python's `weekday()`.
 */
function scheduleWords(r: Reminder): string {
  const sch = r.schedule;
  if (!sch) return "";
  const at = sch.local_time ? ` at ${sch.local_time}` : "";

  if (sch.type === "recurring") {
    const days = sch.days ?? [];
    if (days.length === 0 || days.length === 7) return `Every day${at}`;
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const which = days.map((d) => names[d]).filter(Boolean).join(", ");
    return which ? `${which}${at}` : `Every week${at}`;
  }

  if (sch.type === "event_relative") {
    const m = sch.offset_minutes ?? 0;
    if (m === 0) return "When it happens";
    const mins = Math.abs(m);
    const span = mins % 60 === 0 ? `${mins / 60} ${mins / 60 === 1 ? "hour" : "hours"}` : `${mins} min`;
    return m < 0 ? `${span} before` : `${span} after`;
  }

  // once
  if (sch.at) {
    const d = new Date(sch.at);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + at;
    }
  }
  return at.trim() || "Once";
}
