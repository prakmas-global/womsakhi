"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "slot", eyebrow: "YOUR WEEK", title: "Sell your time, not just things", lede: "Put appointments and available times in one diary so a real booking never gets lost in messages.",
  createLabel: "Add time", titleLabel: "Service or appointment", titlePlaceholder: "Blouse fitting", contactLabel: "Customer (leave blank if free)", dateLabel: "Date and time", amountLabel: "Price (₹)", noteLabel: "Place or preparation note",
  examples: ["Blouse fitting", "Mehendi", "Tuition", "Home visit"], initialStatus: "open", statuses: [{ value: "open", label: "Available" }, { value: "scheduled", label: "Booked" }, { value: "resolved", label: "Completed" }, { value: "paused", label: "Closed" }], empty: "Your diary is empty. Add a free time or a confirmed customer appointment.",
}} />; }
