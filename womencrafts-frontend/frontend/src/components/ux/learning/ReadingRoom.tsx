"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiLesson } from "@/lib/growth-api";
import { apiBase } from "@/lib/api-base";
import s from "./ReadingRoom.module.css";

export function readingPages(body:string) {
  const pages:{start:number;text:string}[]=[];
  for(let start=0;start<body.length;) {
    let end=Math.min(body.length,start+1800);
    if(end<body.length){const paragraph=body.lastIndexOf("\n\n",end);const space=body.lastIndexOf(" ",end);if(paragraph>start+900)end=paragraph+2;else if(space>start+900)end=space+1;}
    pages.push({start,text:body.slice(start,end)});start=end;
  }
  return pages.length?pages:[{start:0,text:"This reading has no text yet."}];
}

export function ReadingRoom({courseId,lessonNumber,lesson,canSave}:{courseId:string;lessonNumber:number;lesson:ApiLesson;canSave:boolean}) {
  const pages=useMemo(()=>readingPages(lesson.body??""),[lesson.body]);
  const [requestedPage,setPage]=useState(()=>Math.max(0,pages.findLastIndex(p=>p.start<=(lesson.reading_offset??0))));
  const page=Math.min(requestedPage,pages.length-1);
  const [size,setSize]=useState(19);
  const [direction,setDirection]=useState("next");
  const [status,setStatus]=useState("Saving your place…");
  const [saving,setSaving]=useState(canSave&&!!lesson.revision);
  const paper=useRef<HTMLElement>(null);
  const [retry,setRetry]=useState(0);
  const current=pages[Math.min(page,pages.length-1)];
  useEffect(()=>{
    if(!canSave||!lesson.revision)return;
    let active=true;
    // keepalive lets this small bookmark finish when she leaves the page.
    fetch(`${apiBase()}/me/programs/${courseId}/lessons/${lessonNumber}/reading`,{
      method:"PUT",credentials:"include",keepalive:true,headers:{"Content-Type":"application/json"},
      body:JSON.stringify({offset:current.start,revision:lesson.revision}),
    }).then(response=>{if(!response.ok)throw new Error();if(active)setStatus("Place saved to your account");})
      .catch(()=>{if(active)setStatus("Could not save your place. Try again before leaving.");})
      .finally(()=>{if(active)setSaving(false);});
    return()=>{active=false;};
  },[courseId,lessonNumber,lesson.revision,canSave,current.start,retry]);
  const move=(next:number)=>{if(next===page)return;setDirection(next<page?"previous":"next");setSaving(canSave&&!!lesson.revision);setStatus("Saving your place…");setPage(Math.max(0,Math.min(pages.length-1,next)));paper.current?.scrollIntoView({block:"start",behavior:"smooth"});};
  const navigation=(
<div className={s.navigation}>
      <button type="button" disabled={page===0||saving} onClick={()=>move(page-1)}>← Previous page</button>
      <label>Page <select aria-label="Go to reading page" value={page} disabled={saving} onChange={e=>move(Number(e.target.value))}>{pages.map((_,i)=><option key={i} value={i}>{i+1}</option>)}</select> of {pages.length}</label>
      <button type="button" disabled={page===pages.length-1||saving} onClick={()=>move(page+1)}>Next page →</button>
    </div>
  );
  return <section className={s.reader} aria-label={`${lesson.content_type === "book" ? "Book" : "Article"} reader`}>
    <div className={s.toolbar}>
      <span>{lesson.content_type==="book"?"BOOK":"ARTICLE"} · Your reading space</span>
      <div role="group" aria-label="Reading text size"><button type="button" disabled={size<=16} onClick={()=>setSize(size-1)} aria-label="Smaller reading text">A−</button><button type="button" disabled={size>=26} onClick={()=>setSize(size+1)} aria-label="Larger reading text">A+</button></div>
    </div>
    <p className={s.hint}>Turn pages below. Your text is laid out automatically—no page formatting needed.</p>
    {navigation}
    <article key={page} ref={paper} data-direction={direction} className={s.paper} style={{fontSize:size}} aria-label={`Reading page ${page+1}`}>
      <p className={s.runningTitle}>{lesson.title}</p>
      {current.text.split(/\n\s*\n/).filter(p=>p.trim()).map((p,i)=>/^#{1,3}\s/.test(p)?<h2 key={i}>{p.replace(/^#{1,3}\s/,"")}</h2>:<p key={i}>{p}</p>)}
      <span className={s.pageNumber}>{page+1}</span>
    </article>
    {navigation}
    <p className={s.saved} role="status">{canSave?status:"Preview · reading places are saved for enrolled learners."} {canSave&&status.startsWith("Could not")&&<button type="button" onClick={()=>{setSaving(true);setStatus("Saving your place…");setRetry(retry+1);}}>Retry save</button>}</p>
    <p className={s.hint}>{canSave ? 'Your page is remembered separately from lesson completion. Use “Done” below when you finish learning.' : 'Preview only. Enrolled learners can save their place when reading.'}</p>
  </section>;
}
