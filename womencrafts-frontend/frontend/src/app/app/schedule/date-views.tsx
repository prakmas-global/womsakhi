"use client";

import Link from "next/link";
import type { WeekDay, WeekItem } from "@/lib/week-api";
import s from "./schedule.module.css";

export function localISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export const localDate = (iso: string) => new Date(`${iso}T12:00:00`);

export function monthDays(anchor: string): WeekDay[] {
  const date = localDate(anchor);
  date.setDate(1); date.setDate(1-date.getDay());
  const today = localISO();
  return Array.from({length:42},(_,i)=>{
    const next = new Date(date); next.setDate(date.getDate()+i);
    const iso = localISO(next);
    return {date:iso,day:next.getDate(),label:next.toLocaleDateString("en-IN",{weekday:"short"}),today:iso===today};
  });
}

export function CalendarMonth({anchor, items, selected, onSelect}: {anchor:string;items:WeekItem[];selected:string;onSelect:(date:string)=>void}) {
  const days = monthDays(anchor);
  return <section className={s.monthGrid} aria-label="Month calendar">
    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><div className={s.monthDayName} key={day}>{day}</div>)}
    {days.map(day=>{
      const entries = items.filter(item=>item.date===day.date);
      return <div key={day.date} className={`${s.monthCell} ${day.date.slice(0,7)!==anchor.slice(0,7)?s.outsideMonth:""}`} data-selected={day.date===selected||undefined}>
        <button type="button" aria-label={`${localDate(day.date).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}, ${entries.length} activities`} aria-pressed={day.date===selected} onClick={()=>onSelect(day.date)} data-today={day.today||undefined}>{day.day}</button>
        <div className={s.monthEvents}>{entries.slice(0,2).map(item=><Link href={item.href} data-cat={item.category} key={item.id}>{item.title}</Link>)}</div>
        <div className={s.monthDots} aria-hidden>{entries.slice(0,4).map(item=><span key={item.id} data-cat={item.category}/>)}</div>
        {entries.length>2&&<button type="button" className={s.moreEvents} onClick={()=>onSelect(day.date)}>+{entries.length-2} more</button>}
      </div>;
    })}
  </section>;
}
