"use client";

import { kindLook, useOpportunityTypePictures, useOpportunityTypes } from "@/components/ux/work/types";
import { CategoryTiles, PictureChoice, SkillChip } from "@/components/ux/work/pictures";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { Back, Btn, Card, ScreenSkeleton } from "@/components/ux/kit";
import { Label, More, Picks, Stepper, Text } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  apiEditJob, apiMyJobPosts, apiPostJob, apiWorkTaxonomy,
  type JobInput, type MyJobPost, type WorkCategory,
} from "@/lib/work-api";

/**
 * Post a job — any verified member who needs women for work: a boutique short
 * of two tailors, a caterer who needs a cook for the wedding season.
 *
 * The job is built from the same skill masters women pick in My work profile
 * (backend: routes/work_talent.py), so the women whose skills match are told
 * about it, and Find work can rank it against each woman's own skills. Nearly
 * everything is a tap; the title fills itself in from what she picked.
 */


const WHERE = [
  { key: "On-site", label: "At my place" },
  { key: "Remote", label: "From home" },
  { key: "Hybrid", label: "Both" },
];
const PAYS = ["₹500 / day", "₹8,000 / month", "₹12,000 / month", "₹15,000 / month", "Per piece — we agree", "To be discussed"];
const EXPERIENCE = ["No experience needed", "1+ years", "3+ years", "5+ years"];
const PHRASES = ["Work from 10 to 6", "Lunch provided", "Training given", "Materials provided", "Weekly payment"];
const LAST_DATES = [
  { label: "In a week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In a month", days: 30 },
  { label: "No last date", days: 0 },
];

const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const autoTitle = (names: string[], openings: number) => {
  if (!names.length) return "";
  const who = openings === 1 ? "1 person" : `${openings} people`;
  const what = names.length > 2 ? `${names.slice(0, 2).join(", ")} and more` : names.join(" and ");
  return `${who} for ${what}`;
};

const togglePhrase = (note: string, phrase: string) => {
  const parts = note.split(". ").map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
  return (parts.includes(phrase) ? parts.filter((x) => x !== phrase) : [...parts, phrase]).join(". ");
};

const noSubscribe = () => () => {};

export default function PostJobPage() {
  // Types are the staff-controlled master; the built-in five show until it loads.
  const KINDS = useOpportunityTypes().map((k) => ({ key: k, ...kindLook(k) }));
  const kindPictures = useOpportunityTypePictures();
  const router = useRouter();
  // `?id=` edits one of her posts. Read as an external store so the server
  // render (no URL) and the first client render agree.
  const editId = useSyncExternalStore(noSubscribe,
    () => new URLSearchParams(window.location.search).get("id"), () => null);

  const tax = useResource(useCallback((s: AbortSignal) => apiWorkTaxonomy(s), []), [] as WorkCategory[]);
  const posts = useResource(
    useCallback((s: AbortSignal) => (editId ? apiMyJobPosts(s) : Promise.resolve([] as MyJobPost[])), [editId]),
    [] as MyJobPost[]);
  const editing = editId ? posts.data.find((p) => p.id === editId) ?? null : null;

  const [cat, setCat] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const requestedKind = useSyncExternalStore(noSubscribe,
    () => new URLSearchParams(window.location.search).get("kind"), () => null);
  const [kindChoice, setKind] = useState<string|null>(null);
  const kind = kindChoice ?? (requestedKind === "Craft order" ? "Craft order" : "Job");
  const bulk = kind === "Craft order";
  const [city,setCity]=useState("");
  const [area,setArea]=useState("");
  const [quantity,setQuantity]=useState("100");
  const [unit,setUnit]=useState("pieces");
  const [delivery,setDelivery]=useState("");
  const [materials,setMaterials]=useState("");
  const [paymentTerms,setPaymentTerms]=useState("");
  const [mode, setMode] = useState("On-site");
  const [location, setLocation] = useState("");
  const [pay, setPay] = useState("");
  const [openings, setOpenings] = useState("1");
  const [experience, setExperience] = useState("");
  const [lastPick, setLastPick] = useState("");
  const [deadline, setDeadline] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Her post into the form, once it has loaded — during render, not in an
  // effect, so the first paint already shows it.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (editing && editing.id !== loadedId) {
    setLoadedId(editing.id);
    setCat(editing.category); setKeys(editing.skill_keys); setTitle(editing.title); setTitleTouched(true);
    setCity(editing.city ?? "");setArea(editing.area ?? "");
    setQuantity(String(editing.order_details?.quantity ?? 100));setUnit(editing.order_details?.unit ?? "pieces");
    setDelivery(editing.order_details?.delivery_date ?? "");setMaterials(editing.order_details?.materials ?? "");setPaymentTerms(editing.order_details?.payment_terms ?? "");
    setKind(editing.kind); setMode(editing.mode); setLocation(editing.location); setPay(editing.pay);
    setOpenings(String(editing.openings)); setExperience(editing.experience); setDeadline(editing.deadline);
    setLastPick(editing.deadline ? "" : "No last date"); setDesc(editing.desc);
  }

  const category = tax.data.find((c) => c.key === cat);
  const names = useMemo(() => {
    const all = new Map(tax.data.flatMap((c) => c.skills.map((s) => [s.key, s.name] as const)));
    return keys.map((k) => all.get(k) ?? k);
  }, [tax.data, keys]);
  const n = Math.max(1, Number(openings) || 1);
  const shownTitle = titleTouched ? title : bulk && names.length ? `${quantity} ${unit} · ${names[0]}` : autoTitle(names, n);

  const toggleSkill = (key: string) => {
    if (keys.includes(key)) { setKeys(keys.filter((k) => k !== key)); return; }
    if (keys.length >= 10) { toast("Up to 10 skills", { tone: "error" }); return; }
    setKeys([...keys, key]);
  };

  const ready = keys.length > 0 && shownTitle.trim().length >= 4 && (!bulk || (
    city.trim().length > 0 && Number.isInteger(Number(quantity)) && Number(quantity)>=1 && Number(quantity)<=1000000 && unit.trim().length>0 && !!delivery && (editing || delivery>=isoIn(0)) && (!deadline || deadline<=delivery) && materials.trim().length>=3 && paymentTerms.trim().length>=3));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setError("");
    const input: JobInput = {
      title: shownTitle.trim(), category: cat, skill_keys: keys, kind, mode,
      location: location.trim(), pay: pay.trim(), openings: Math.min(50, n), deadline,
      desc: desc.trim(), experience, city: bulk ? city.trim() : "", area: bulk ? area.trim() : "",
      order_details: bulk ? {quantity:Number(quantity),unit:unit.trim(),delivery_date:delivery,materials:materials.trim(),payment_terms:paymentTerms.trim()} : null,
    };
    try {
      const job = editing ? await apiEditJob(editing.id, input) : await apiPostJob(input);
      toast(editing ? "Your post is updated" : bulk ? "Your big order is posted" : "Your job is posted", { tone: "success" });
      router.push(`/app/work/posts?job=${job.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "That did not save. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const status = (tax.error as { response?: { status?: number } } | null)?.response?.status;
  if (tax.source === "loading" || (editId && posts.source === "loading")) {
    return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;
  }
  if (status === 403) {
    return (
      <HomeShell>
        <ScreenHead title="Post a job" />
        <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>
          Posting a job opens once your account is verified. We will tell you as soon as it is.
        </p></Card>
      </HomeShell>
    );
  }
  if (editId && posts.source !== "loading" && !editing) {
    return (
      <HomeShell>
        <Back to="/app/work/posts" label="My posts & applicants" className="mb-4" />
        <ScreenHead title="Edit job post" />
        <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>That job post was not found among yours.</p></Card>
      </HomeShell>
    );
  }

  const whereLabel = WHERE.find((w) => w.key === mode)?.label ?? mode;
  const kindLabel = KINDS.find((k) => k.key === kind)?.title ?? kind;

  return (
    <HomeShell
      rail={
        <Card className="xl:sticky xl:top-[96px]">
          <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>{bulk ? "How it looks in Big orders" : "How it looks in Find work"}</p>
          <div className="mt-3 rounded-[14px] border p-4" style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}>
            <p className="text-sm font-bold leading-snug" style={{ color: shownTitle ? "var(--ux-ink)" : "var(--ux-faint)" }}>
              {shownTitle || "Your job title"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
              {kindLabel} · {whereLabel}{bulk ? ` · ${[area,city].filter(Boolean).join(", ")}` : location.trim() ? ` · ${location.trim()}` : ""}
            </p>
            {names.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {names.map((x) => (
                  <span key={x} className="rounded-full px-2 py-[3px] text-2xs font-semibold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{x}</span>
                ))}
              </div>
            )}
            <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ux-ink-2)" }}>
              {pay && <span className="inline-flex items-center gap-1"><Icons.IndianRupee className="h-3.5 w-3.5" />{pay}</span>}
              <span className="inline-flex items-center gap-1"><Icons.Users className="h-3.5 w-3.5" />{n} {n === 1 ? "opening" : "openings"}</span>
              {experience && <span>{experience}</span>}
            </p>
            {desc.trim() && <p className="mt-2 line-clamp-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{desc.trim()}</p>}
          </div>
        </Card>
      }
    >
      <Back to="/app/work/posts" label="My posts & applicants" className="mb-4" />
      <ScreenHead title={editing ? "Edit your post" : bulk ? "Post a big order" : "Post a job"}
                  sub={bulk ? "Ask for a quantity of products by a delivery date. Matching women in your town can respond; you choose who joins. A job instead hires someone for a role or task." : "Hire someone for a role or task. For a batch of products with a quantity and delivery date, choose Big order below. Phone numbers stay private until shared."} />

      <Card className="mb-[16px]">
        <Label need>What work is it?</Label>
        <CategoryTiles cats={tax.data} value={cat} onPick={setCat}
                       count={(c) => c.skills.filter((s) => keys.includes(s.key)).length} />
        {category ? (
          <div key={category.key} className="ux-fade mt-2 rounded-[14px] p-3" style={{ background: "var(--ux-surface-2)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--ux-ink-2)" }}>{category.name} — tap the skills you need, up to 10</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Skills">
              {[...category.skills].sort((a, b) => Number(b.popular) - Number(a.popular)).map((sk, i) => (
                <SkillChip key={sk.key} skill={sk} cat={category} index={i} on={keys.includes(sk.key)} onClick={() => toggleSkill(sk.key)} />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>Pick a kind of work to see its skills.</p>
        )}
        {keys.length > 0 && (
          <p className="mt-3 text-xs" style={{ color: "var(--ux-ink-2)" }}>
            Needs: <b style={{ color: "var(--ux-ink)" }}>{names.join(", ")}</b>
          </p>
        )}

        <div className="mt-5">
          <Label need>{bulk ? "How many makers do you need?" : "How many people?"}</Label>
          <Stepper value={openings} onChange={setOpenings} label="Openings" min={1} presets={[1, 2, 5, 10]} />
        </div>

        <div className="mt-5">
          <Label need>{bulk ? "Order title" : "Job title"}</Label>
          <Text value={shownTitle} onChange={(v) => { setTitle(v); setTitleTouched(true); }} label={bulk ? "Order title" : "Job title"}
                placeholder="Filled in from the skills you pick" max={100} />
          {!titleTouched && names.length > 0 && (
            <p className="mt-1.5 text-2xs" style={{ color: "var(--ux-faint)" }}>Written for you from the skills — change any word.</p>
          )}
          {names.length > 0 && (
            <Picks options={[
              autoTitle(names, n),
              `${names[0]} work${location.trim() ? ` in ${location.trim()}` : ""}`,
              `Need help with ${names[0].toLowerCase()}`,
            ]} value={shownTitle} label="Title ideas" onPick={(x) => { setTitle(x); setTitleTouched(true); }} />
          )}
        </div>
      </Card>

      <Card className="mb-[16px]">
        <Label>What kind of work</Label>
        <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map((k) => (
            <PictureChoice key={k.key} src={kindPictures[k.key] ?? ""} title={k.title} sub={k.sub} on={kind === k.key} onClick={() => setKind(k.key)} />
          ))}
        </div>

        <div className="mt-5">
          <Label>Where</Label>
          <Picks options={WHERE.map((w) => w.label)} value={whereLabel} label="Where"
                 onPick={(l) => setMode(WHERE.find((w) => w.label === l)?.key ?? "On-site")} />
        </div>

        {bulk ? <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><Label need>Town or city</Label><Text value={city} onChange={setCity} label="Order town or city" placeholder="e.g. Hyderabad" max={80}/></div>
          <div><Label hint="optional">Area or locality</Label><Text value={area} onChange={setArea} label="Order area" placeholder="e.g. Kukatpally" max={80}/></div>
          <p className="text-xs sm:col-span-2" style={{color:"var(--ux-muted)"}}>Used for nearby orders and matching makers. Enter the pickup/delivery town even when women make the items from home. Keep your full address for private chat.</p>
        </div> : <div className="mt-4 max-w-[420px]">
          <Label hint="optional">Town or area</Label>
          <Text value={location} onChange={setLocation} label="Town or area" placeholder="e.g. Kukatpally, Hyderabad" max={80} />
        </div>}
      </Card>

      {bulk && <Card className="mb-[16px] flex flex-col gap-4">
        <h2 className="text-lg font-bold">What needs to be delivered?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Quantity *<input className="mt-2 min-h-[44px] w-full rounded-xl border px-3" style={{background:"var(--ux-surface)",borderColor:"var(--ux-line-strong)",color:"var(--ux-ink)"}} aria-label="Order quantity" type="number" min={1} max={1000000} step={1} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
          <div><Label need>Unit</Label><Text label="Order unit" value={unit} onChange={setUnit} max={30} placeholder="pieces, packets, sets"/></div>
          <label className="text-sm font-semibold">Delivery date *<input className="mt-2 min-h-[44px] w-full rounded-xl border px-3" style={{background:"var(--ux-surface)",borderColor:"var(--ux-line-strong)",color:"var(--ux-ink)"}} aria-label="Order delivery date" type="date" min={editing?undefined:isoIn(0)} value={delivery} onChange={e=>setDelivery(e.target.value)}/></label>
        </div>
        <div><Label need>Who provides the materials?</Label><Text label="Order materials" value={materials} onChange={setMaterials} max={300} placeholder="e.g. I provide cloth; makers provide thread"/></div>
        <div><Label need>When and how will makers be paid?</Label><Text label="Order payment terms" value={paymentTerms} onChange={setPaymentTerms} max={500} placeholder="e.g. ₹180 per piece, UPI within 7 days of accepted delivery"/></div>
        <p className="text-xs" style={{color:"var(--ux-muted)"}}>Agree each maker’s share and acceptance requirements before starting. Applying does not allocate pieces or confirm payment.</p>
      </Card>}

      <Card className="mb-[16px]">
        <Label>Pay</Label>
        <Picks options={bulk ? ["₹100 / piece", "₹180 / piece", "₹500 / set", "To be discussed"] : PAYS} value={pay} label="Pay" onPick={(p) => setPay(pay === p ? "" : p)} />
        <div className="mt-2.5 max-w-[420px]">
          <Text value={pay} onChange={setPay} label="Pay" placeholder={bulk ? "e.g. ₹180 / piece" : "Or write it: ₹10,000 / month"} max={80} />
        </div>

        <div className="mt-5">
          <Label>Experience</Label>
          <Picks options={EXPERIENCE} value={experience} label="Experience"
                 onPick={(x) => setExperience(experience === x ? "" : x)} />
        </div>

        <div className="mt-5">
          <Label>Last date to apply</Label>
          <Picks options={LAST_DATES.map((d) => d.label)} value={lastPick} label="Last date"
                 onPick={(l) => {
                   const d = LAST_DATES.find((x) => x.label === l)!;
                   setLastPick(l); setDeadline(d.days ? isoIn(d.days) : "");
                 }} />
          {deadline && <p className="mt-1.5 text-2xs" style={{ color: "var(--ux-faint)" }}>Applications close on {deadline}.</p>}
        </div>

        <More label="Anything else to say (optional)" open={!!desc}>
          <Picks options={PHRASES} value={desc.split(". ").map((x) => x.trim().replace(/\.$/, ""))} multi label="Details"
                 onPick={(x) => setDesc(togglePhrase(desc, x))} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} rows={3}
                    aria-label="Details" placeholder="Or in your own words"
                    className="ux-sq mt-3 w-full rounded-[12px] border px-4 py-3 text-xsm leading-relaxed outline-none"
                    style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        </More>
      </Card>

      <div className="sticky bottom-[84px] z-10 lg:bottom-4 lg:pe-[76px]">
        <Card style={{ background: "var(--ux-surface)", boxShadow: "0 10px 30px -12px rgba(30,10,40,.28)" }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p role={error ? "alert" : undefined} className="text-xs"
               style={{ color: error ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
              {error || (ready ? bulk ? "Matching makers in this town will be told about it." : "Women with these skills will be told about it." : bulk ? "Add skills, town, quantity, delivery date, materials and payment terms. Applications must close by delivery." : "Pick at least one skill to post.")}
            </p>
            <Btn variant="primary" icon={editing ? "Check" : "Send"} loading={busy} disabled={!ready}
                 onClick={() => void submit()}>
              {editing ? "Save changes" : bulk ? "Post the big order" : "Post the job"}
            </Btn>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
