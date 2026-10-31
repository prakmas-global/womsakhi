"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {apiSaveAccountUpi,useAccountUpi} from "@/lib/account-upi-api";
import {apiErrorMessage} from "@/lib/api";

export function AccountUpiEditor({onSaved}:{onSaved?:(value:string)=>void}){
 const upi=useAccountUpi();const callback=useRef(onSaved);
 useEffect(()=>{callback.current=onSaved;},[onSaved]);
 useEffect(()=>{if(upi.source==="live"&&upi.data)callback.current?.(upi.data.upi_id);},[upi.source,upi.data]);
 const [draft,setDraft]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
 const value=draft??upi.data?.upi_id??"";
 const valid=/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(value.trim())&&value.trim().length<=80;
 const save=async()=>{if(!valid||busy)return;setBusy(true);setError("");setSaved(false);try{const result=await apiSaveAccountUpi(value.trim());callback.current?.(result.upi_id);setDraft(null);setSaved(true);upi.refetch();window.dispatchEvent(new Event("womsakhi:upi-updated"));}catch(e){setError(apiErrorMessage(e,"Your UPI did not save. Try again."));}finally{setBusy(false);}};
 return <div className="space-y-3" data-account-upi>
  <div><h3 className="text-sm font-bold">Your UPI across WomSakhi</h3><p className="mt-1 text-xs leading-relaxed" style={{color:"var(--ux-muted)"}}>Save once for courses, mentoring and collecting customer payments. Updating here changes the same account setting everywhere.</p></div>
  {upi.source==="loading"?<p role="status" className="text-sm">Loading your UPI…</p>:upi.source==="error"?<p role="alert" className="text-sm">Your UPI could not load. <button type="button" onClick={()=>upi.refetch()} className="underline">Try again</button></p>:<>
   <label className="block text-sm font-semibold">Receiving UPI ID
    <input aria-label="Account UPI ID" value={value} maxLength={80} disabled={busy} onChange={e=>{setDraft(e.target.value);setError("");setSaved(false);}} placeholder="yourname@okaxis" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-2 min-h-[44px] w-full min-w-0 rounded-xl border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ux-brand)]" style={{background:"var(--ux-surface)",borderColor:"var(--ux-line-strong)",color:"var(--ux-ink)"}}/>
   </label>
   {!upi.data?.configured&&!!upi.data?.existing_upi_ids.length&&<div><p className="text-xs" style={{color:"var(--ux-muted)"}}>Previously saved IDs: choose one, then save it for the whole app.</p><div className="mt-2 flex flex-wrap gap-2">{upi.data.existing_upi_ids.map(id=><button type="button" key={id} onClick={()=>{setDraft(id);setSaved(false);}} className="min-h-[44px] max-w-full break-all rounded-xl border px-3 text-sm" style={{borderColor:"var(--ux-line-strong)"}}>{id}</button>)}</div></div>}
   <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={()=>void save()} disabled={!valid||busy||(upi.data?.configured&&value.trim()===upi.data.upi_id)} className="min-h-[44px] rounded-xl px-4 text-sm font-bold disabled:opacity-45" style={{background:"var(--ux-fill)",color:"white"}}>{busy?"Saving…":"Save UPI for all payments"}</button><Link href="/app/settings/payments" className="text-xs underline" style={{color:"var(--ux-brand)"}}>Payment settings</Link></div>
  </>}
  {error&&<p role="alert" className="text-sm" style={{color:"var(--ux-danger-ink)"}}>{error}</p>}
  {saved&&<p role="status" className="text-sm" style={{color:"var(--ux-green-ink)"}}>UPI updated across your account.</p>}
  <p className="text-xs leading-relaxed" style={{color:"var(--ux-muted)"}}>Use the UPI ID from your payment app. Payment references already submitted and confirmed records are kept. Receipt still needs your confirmation; this setting does not transfer money.</p>
 </div>;
}
