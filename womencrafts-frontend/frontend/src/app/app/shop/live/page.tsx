"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "live", eyebrow: "SHOW AND SELL", title: "Plan a live sale for your own people", lede: "Schedule a sale, record where it will happen, and keep the result. Use the video service your customers already use.",
  createLabel: "Plan live sale", titleLabel: "Sale name", titlePlaceholder: "Saturday cotton collection", contactLabel: "Channel or group", dateLabel: "Starts at", amountLabel: "Sales target (₹)", noteLabel: "Products, link, and message to send",
  examples: ["New collection", "Festival sale", "End-of-week stock", "Made-to-order preview"], contactOptions: ["WhatsApp group", "WhatsApp status", "Instagram live", "Facebook live", "In person, at home"], amountPresets: [2000, 5000, 10000], notePicks: ["New designs", "Festival stock", "Discount for first 10 buyers", "Send the link an hour before", "Pay by UPI to book"], initialStatus: "scheduled", statuses: [{ value: "scheduled", label: "Scheduled" }, { value: "open", label: "Live now" }, { value: "resolved", label: "Finished" }, { value: "paused", label: "Cancelled" }], empty: "No live sale is planned. Choose a short time when your customers are already on their phones.",
}} />; }
