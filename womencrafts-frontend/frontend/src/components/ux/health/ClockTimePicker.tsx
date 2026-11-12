"use client";

import { useState } from "react";
import s from "./ClockTimePicker.module.css";

/** A full-day clock. The stored value remains the health API's HH:mm. */
export function ClockTimePicker({ value, onChange, label }: {value:string;onChange:(time:string)=>void;label:string}) {
  const [mode,setMode]=useState<"hour"|"minute">("hour");
  const hour=Number(value.slice(0,2)), minute=Number(value.slice(3,5));
  const hour12=hour%12||12, period=hour<12?"AM":"PM";
  const set=(h:number,m:number)=>onChange(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  const angle=(mode==="hour"?hour12*30:minute*6);
  return <div className={s.picker} role="group" aria-label={label}>
    <div className={s.display}>
      <div className={s.digits}>
        <button type="button" aria-label={`${label}: choose hour`} aria-pressed={mode==="hour"} onClick={()=>setMode("hour")}>{String(hour12).padStart(2,"0")}</button>
        <span>:</span>
        <button type="button" aria-label={`${label}: choose minute`} aria-pressed={mode==="minute"} onClick={()=>setMode("minute")}>{String(minute).padStart(2,"0")}</button>
      </div>
      <div className={s.period} aria-label={`${label}: AM or PM`} role="group">
        {(["AM","PM"] as const).map(p=><button type="button" key={p} aria-pressed={period===p} onClick={()=>set(hour%12+(p==="PM"?12:0),minute)}>{p}</button>)}
      </div>
    </div>
    <p className={s.hint}>Choose {mode==="hour"?"an hour":"minutes"} on the clock · Any time, AM or PM</p>
    <div className={s.clock} role="group" aria-label={`${label}: ${mode} clock`}>
      <span className={s.hand} style={{transform:`rotate(${angle}deg)`}} aria-hidden="true"/>
      <span className={s.centre} aria-hidden="true"/>
      {Array.from({length:12},(_,i)=>{
        const n=mode==="hour"?(i||12):i*5;
        const selected=mode==="hour"?hour12===n:minute===n;
        return <button type="button" key={i} aria-label={`${label}: ${mode} ${n}`} aria-pressed={selected}
          style={{left:`${50+40*Math.sin(i*Math.PI/6)}%`,top:`${50-40*Math.cos(i*Math.PI/6)}%`}}
          onClick={()=>{if(mode==="hour"){set(n%12+(period==="PM"?12:0),minute);setMode("minute");}else set(hour,n);}}>
          {mode==="minute"?String(n).padStart(2,"0"):n}
        </button>;
      })}
    </div>
    <label className={s.exact}>Exact time
      <input type="time" step="60" value={value} aria-label={`${label}, exact time`} onChange={e=>{if(e.target.value)set(Number(e.target.value.slice(0,2)),Number(e.target.value.slice(3,5)));}}/>
    </label>
    <p className={s.hint}>Use the time field for any minute, such as 2:17 AM.</p>
  </div>;
}
