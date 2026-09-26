"use client";

import { useCallback, useState } from "react";
import { Headphones, MessageCircle, Send } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState } from "@/components/ux/kit";
import { apiMyMessages, apiSendMessage, type MemberMessage } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useToast } from "@/design-system";

export default function HelpdeskPage() {
  const toast = useToast();
  const { data: messages, source, error, refetch } = useResource(
    useCallback(() => apiMyMessages(), []), [] as MemberMessage[],
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const words = body.trim();
    if (!words || sending) return;
    setSending(true);
    try {
      await apiSendMessage(words);
      setBody("");
      await refetch();
      toast.success("Your message reached the support team");
    } catch {
      toast.error("Your message was not sent", { description: "Your words are still here. Check your connection and try again." });
    } finally { setSending(false); }
  }

  return (
    <HomeShell active="/app/helpdesk">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}><Headphones className="h-5 w-5" /></span>
          <div><h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Talk to the WomSakhi team</h1><p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>Write what happened in your own words. A person can reply in this same thread.</p></div>
        </header>

        <Card>
          {source === "loading" ? <p role="status" className="py-8 text-center text-sm" style={{ color: "var(--ux-muted)" }}>Opening your support thread…</p>
          : error ? <EmptyState icon="WifiOff" title="Your support thread did not load" body="Check your connection and try again." action={<Btn onClick={refetch}>Try again</Btn>} />
          : messages.length ? <ol className="max-h-[52vh] space-y-3 overflow-y-auto" aria-label="Support messages">{messages.map((message) => (
              <li key={message.id} className={`flex ${message.sender === "member" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3" style={{ background: message.sender === "member" ? "var(--ux-brand)" : "var(--ux-surface-2)", color: message.sender === "member" ? "var(--ux-on-brand)" : "var(--ux-ink)" }}>
                  <p className="text-sm leading-relaxed">{message.body}</p><p className="mt-1 text-2xs opacity-75">{message.sender_name} · {message.sent_label}</p>
                </div>
              </li>
            ))}</ol>
          : <div className="py-6 text-center"><MessageCircle className="mx-auto h-8 w-8" style={{ color: "var(--ux-brand)" }} /><h2 className="mt-2 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>Start with what you need</h2><p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>Money, work, safety, the app, or something else. You do not need to choose the right category.</p></div>}
        </Card>

        <Card>
          <label htmlFor="support-message" className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Your message</label>
          <textarea id="support-message" rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Tell us what happened and what would help…" className="mt-2 w-full resize-y rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-4" style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs" style={{ color: "var(--ux-muted)" }}>For immediate danger, call 112 or open the Safety centre.</p><Btn disabled={!body.trim() || sending} onClick={() => void send()}><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send to support"}</Btn></div>
        </Card>
      </div>
    </HomeShell>
  );
}
