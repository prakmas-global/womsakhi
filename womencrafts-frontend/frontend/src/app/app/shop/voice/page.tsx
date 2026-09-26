"use client";
import { OperationScreen } from "@/components/ux/shopplus/operation-screen";
export default function Page() { return <OperationScreen config={{
  kind: "voice", eyebrow: "SAY IT, THEN CHECK IT", title: "Make a listing draft in your own words", lede: "Use your phone keyboard microphone to dictate. Save the draft here, check the price, then copy it into your shop listing.",
  createLabel: "Save spoken draft", titleLabel: "What do you sell?", titlePlaceholder: "Tap your keyboard microphone and speak", contactLabel: "Language", dateLabel: "Review by", amountLabel: "Price (₹)", noteLabel: "Description in your own words",
  examples: ["Tailoring service", "Home-cooked food", "Handmade product", "Private lesson"], initialStatus: "draft", statuses: [{ value: "draft", label: "Needs checking" }, { value: "open", label: "Ready to list" }, { value: "resolved", label: "Added to shop" }], empty: "No voice drafts yet. Use the microphone on your phone keyboard and save the words you want customers to read.",
}} />; }
