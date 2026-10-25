"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "subscription", eyebrow: "EVERY MONTH", title: "Money you can count on", lede: "Keep standing customer orders together and update each one when the new month is paid.",
  createLabel: "Add regular customer", titleLabel: "Standing order", titlePlaceholder: "Weekday lunch boxes", contactLabel: "Customer name", dateLabel: "Next payment due", amountLabel: "Amount per month (₹)", noteLabel: "What is included",
  examples: ["Monthly tiffin", "Weekly tailoring", "Tuition", "Beauty visits"], amountPresets: [500, 1000, 1500, 3000], notePicks: ["Lunch on weekdays", "Dinner every day", "Two visits a month", "Paid at month start", "Pays by UPI", "Pays in cash"], initialStatus: "waiting", statuses: [{ value: "waiting", label: "Payment due" }, { value: "paid", label: "Paid this month" }, { value: "paused", label: "Paused" }, { value: "resolved", label: "Ended" }], empty: "No regular customers recorded yet. Add someone who buys from you again and again.",
}} />; }
