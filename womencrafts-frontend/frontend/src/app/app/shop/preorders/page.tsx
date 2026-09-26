"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "preorder", eyebrow: "MATERIAL MONEY", title: "Let the order pay for its materials", lede: "Record the material money you need before work starts, who it is from, and whether it has arrived.",
  createLabel: "Add pre-order", titleLabel: "What are you making?", titlePlaceholder: "Six festival blouses", contactLabel: "Buyer name", dateLabel: "Needed by", amountLabel: "Material cost (₹)", noteLabel: "What the money covers",
  examples: ["Blouse order", "Catering order", "Gift hamper", "Uniform order"], initialStatus: "waiting", statuses: [{ value: "waiting", label: "Waiting for money" }, { value: "paid", label: "Materials paid" }, { value: "open", label: "Work started" }, { value: "resolved", label: "Completed" }], empty: "No pre-orders yet. Add the next order that needs material money before you begin.",
}} />; }
