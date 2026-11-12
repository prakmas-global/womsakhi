import { redirect } from "next/navigation";

/** Gateway checkout is unavailable in the direct-UPI release. */
export default function CheckoutPage() { redirect("/app/payments"); }
