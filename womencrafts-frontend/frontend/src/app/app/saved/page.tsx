"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";
import type { LucideIcon } from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useSavedItems } from "@/components/ux/entitlements";
import { apiUnsave, type SavedKind } from "@/lib/entitlements-api";
import styles from "./saved.module.css";

type Item = { id:string; kind:string; title:string; sub:string; href:string; art:string; gone:boolean; savedOn:string; refKind:SavedKind; refId:string };
const LOOK: Record<SavedKind,{route:string;label:string;art:string}> = {
  job:{route:"/app/opportunities",label:"Opportunities",art:"/ux/art/work-dashboard-writing.webp"}, program:{route:"/app/programs",label:"Learning",art:"/ux/art/learn-dashboard-business.webp"},
  event:{route:"/app/events",label:"Events",art:"/ux/art/circle-study-group.webp"}, scheme:{route:"/app/support-fund",label:"Resources",art:"/ux/art/course-counting-coins-calculator.webp"},
  mentor:{route:"/app/mentors",label:"People",art:"/ux/art/avatar-woman-teal-shirt.webp"}, service:{route:"/app/explore",label:"Resources",art:"/ux/art/scene-woman-reading-document.webp"},
  listing:{route:"/app/market",label:"Products",art:"/ux/art/earn-market.webp"}, post:{route:"/app/circles",label:"Community",art:"/ux/art/circle-women-talking.webp"},
};
const FILTERS=["All","Opportunities","Learning","Products","Events","People","Resources","Community"];
const FILTER_ICONS:Record<string,LucideIcon>={All:Icons.Heart,Opportunities:Icons.Briefcase,Learning:Icons.BookOpen,Products:Icons.ShoppingBag,Events:Icons.CalendarDays,People:Icons.Users,Resources:Icons.FileText,Community:Icons.MessagesSquare};
function relativeDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return"Saved recently";const d=Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));return d===0?"Saved today":d===1?"Saved yesterday":d<7?`Saved ${d} days ago`:d<14?"Saved 1 week ago":`Saved ${Math.floor(d/7)} weeks ago`}

function Rail({items}:{items:Item[]}){const groups=["Learning","Opportunities","Events","People","Products","Resources"];return <div className={styles.rail}>
  <section className={styles.railCard}><div className={styles.savedTotal}><span><Icons.Heart fill="currentColor"/></span><div><h2>You&apos;ve saved {items.length} items</h2><p>Ideas, opportunities and people for your brighter tomorrow.</p></div></div><div className={styles.countGrid}>{groups.map(g=>{const I=FILTER_ICONS[g];return <div key={g}><I/><b>{items.filter(i=>i.kind===g).length}</b><small>{g}</small></div>})}</div></section>
  <section className={styles.promo}><Image src="/ux/saved/saved-promo-v1.png" alt="Woman organising ideas she wants to revisit" fill sizes="300px"/><div><h2>Save what<br/>inspires you.</h2><p>Your future self<br/>will thank you.</p></div></section>
  {items.length>0&&<section className={styles.railCard}><header><h2>Recently saved</h2></header><div className={styles.recent}>{items.slice(0,4).map(i=><Link key={i.id} href={(i.href||"/app/saved") as never}><Image src={i.art} alt="" width={48} height={38} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>{i.title}</b><small>{i.kind}</small></span></Link>)}</div></section>}
  <blockquote className={styles.quote}>“A small save today can lead to a big opportunity tomorrow.”<cite>— WomSakhi</cite></blockquote>
 </div>}

export default function SavedPage(){
 const{data:rows,refetch}=useSavedItems();const[filter,setFilter]=useState("All");const[sort,setSort]=useState("newest");const[removed,setRemoved]=useState<string[]>([]);const[menu,setMenu]=useState<string|null>(null);
 const items=useMemo<Item[]>(()=>rows.map(r=>{const l=LOOK[r.kind];return{id:r.id,kind:l.label,title:r.title,sub:r.sub||"Saved for later",href:r.gone?"":(r.href||`${l.route}/${r.ref_id}`),art:l.art,gone:r.gone,savedOn:r.saved_on,refKind:r.kind,refId:r.ref_id}}).filter(i=>!removed.includes(i.id)),[rows,removed]);
 const shown=useMemo(()=>{const list=filter==="All"?items:items.filter(i=>i.kind===filter);return[...list].sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):sort==="oldest"?a.savedOn.localeCompare(b.savedOn):b.savedOn.localeCompare(a.savedOn))},[items,filter,sort]);
 const remove=(i:Item)=>{setRemoved(v=>[...v,i.id]);void apiUnsave(i.refKind,i.refId).catch(()=>{setRemoved(v=>v.filter(x=>x!==i.id));refetch()})};
 return <HomeShell skeleton="list" loadFailed="your saved things" rail={<Rail items={items}/>}> <main className={styles.page}>
  <section className={styles.hero}><Image src="/ux/saved/saved-hero-v1.png" alt="Woman holding a notebook of saved ideas" fill priority sizes="(max-width:900px) 100vw,900px"/><div><p className={styles.breadcrumb}>Home <Icons.ChevronRight/> Saved</p><h1>Saved</h1><p>All the opportunities, resources and people you&apos;ve saved, ready whenever you need them.</p></div></section>
  <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label="Saved item type">{FILTERS.map(f=>{const I=FILTER_ICONS[f];const count=f==="All"?items.length:items.filter(i=>i.kind===f).length;return <button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}><I/><span>{f}</span><small>{count}</small></button>})}</div><label className={styles.sort}>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label></div>
  <section className={styles.list} aria-live="polite">{shown.length?shown.map(i=><article className={styles.item} key={i.id} data-gone={i.gone||undefined}>
   <Link href={(i.href||"/app/saved") as never} className={styles.itemLink} aria-disabled={!i.href}><Image src={i.art} alt="" width={132} height={88} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><div className={styles.itemCopy}><span className={styles.kind}>{i.kind}</span><h2>{i.title}</h2><p>{i.sub}</p><div className={styles.meta}><span><Icons.MapPin/> {i.kind==="Opportunities"?"Remote":"Available online"}</span><span><Icons.Clock/> Flexible</span><span><Icons.BadgeCheck/> Verified</span></div></div></Link>
   <div className={styles.itemActions}><small>{relativeDate(i.savedOn)}</small><div><button className={styles.iconButton} onClick={()=>remove(i)} aria-label={`Remove ${i.title} from saved`} title="Remove from saved"><Icons.Bookmark fill="currentColor"/></button><button className={styles.iconButton} onClick={()=>setMenu(menu===i.id?null:i.id)} aria-label={`More actions for ${i.title}`} aria-expanded={menu===i.id}><Icons.MoreHorizontal/></button></div>{menu===i.id&&<div className={styles.menu}><Link href={(i.href||"/app/saved") as never}>Open item</Link><button onClick={()=>remove(i)}>Remove from saved</button></div>}</div>
  </article>):<div className={styles.empty}><Icons.Bookmark/><h2>No saved items here yet</h2><p>Save something useful and it will wait for you here.</p><Link href="/app/discover">Explore recommendations <Icons.ArrowRight/></Link></div>}</section>
 </main></HomeShell>}
