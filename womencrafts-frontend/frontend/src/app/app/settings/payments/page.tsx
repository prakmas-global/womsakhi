"use client";
import {Card,SettingsPage} from "@/components/ux/settings/Frame";
import {AccountUpiEditor} from "@/components/ux/payments/AccountUpiEditor";

export default function PaymentSettingsPage(){
 return <SettingsPage title="How you get paid" sub="One receiving UPI ID for your whole WomSakhi account.">
  <Card><AccountUpiEditor/></Card>
  <Card><h2 className="text-base font-bold">Used wherever you receive direct UPI payments</h2><p className="mt-2 text-sm leading-relaxed" style={{color:"var(--ux-muted)"}}>Your paid courses, mentoring sessions and customer collection page use this ID. You can update it here or from the same UPI editor inside your course and mentoring forms. Existing submitted references and confirmations stay unchanged.</p><p className="mt-3 text-xs" style={{color:"var(--ux-muted)"}}>Bank payouts remain planned for a future version. Existing saved bank details have not been changed.</p></Card>
 </SettingsPage>;
}
