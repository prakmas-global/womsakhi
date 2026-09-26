"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "dispute", eyebrow: "WHEN SOMETHING GOES WRONG", title: "Keep one clear record and resolve it fairly", lede: "Record what happened, the amount involved, and the next agreed step. A case is private and never affects your shop rating.",
  createLabel: "Open private case", titleLabel: "What went wrong?", titlePlaceholder: "Blouse needs sleeve alteration", contactLabel: "Buyer name", dateLabel: "Follow-up date", amountLabel: "Amount involved (₹)", noteLabel: "Facts, promised solution, and trusted helper",
  examples: ["Quality concern", "Late delivery", "Wrong item", "Payment disagreement"], initialStatus: "open", statuses: [{ value: "open", label: "Open" }, { value: "waiting", label: "Waiting for response" }, { value: "scheduled", label: "Helper meeting" }, { value: "resolved", label: "Resolved" }], empty: "You have no open cases. If something goes wrong, write the agreed facts here while they are fresh.",
}} />; }
