import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card } from "@/components/ux/kit";

export default function WithdrawPage() {
  return <HomeShell active="/app/wallet"><Card><h1 className="text-2xl font-bold">Bank payouts are a future feature</h1><p className="mt-3 text-sm leading-relaxed">Withdrawals and bank transfers are not available in this release. No credits have been deducted. Pay providers directly using their UPI IDs and track recipient confirmation in My Payments.</p><div className="mt-4 flex flex-wrap gap-2"><Btn href="/app/payments">My Payments</Btn><Btn href="/app/money" variant="outline">My Money notebook</Btn></div></Card></HomeShell>;
}
