"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "wholesale", eyebrow: "BIG ORDERS", title: "Twenty pieces to one buyer", lede: "Track a bulk enquiry, the price you quoted, its payment date, and what the buyer decides.",
  createLabel: "Add bulk enquiry", titleLabel: "What and how many?", titlePlaceholder: "120 school uniform shirts", contactLabel: "Buyer or organisation", dateLabel: "Quote or delivery date", amountLabel: "Quoted total (₹)", noteLabel: "Payment terms and work-sharing plan",
  examples: ["School uniforms", "Hostel meals", "Corporate gifts", "Shop restock"], initialStatus: "open", statuses: [{ value: "open", label: "New enquiry" }, { value: "waiting", label: "Quote sent" }, { value: "paid", label: "Deposit received" }, { value: "resolved", label: "Finished" }], empty: "No bulk enquiries recorded. Add one as soon as a buyer asks for a quantity or quote.",
}} />; }
