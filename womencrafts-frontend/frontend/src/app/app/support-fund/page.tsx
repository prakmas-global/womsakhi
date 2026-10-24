import { redirect } from "next/navigation";

/**
 * "Loans & schemes" read the same government-scheme list as What you are owed
 * (/app/haq) — two screens for one catalogue, each with its own idea of what
 * she had applied for. The schemes, her state, her answers and her statuses
 * all live in Haq now; this address forwards there so old links still work.
 */
export default function SupportFundMoved() {
  redirect("/app/haq");
}
