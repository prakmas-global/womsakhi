"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/design-system";

/**
 * "Member support" and "Messages" are now the same inbox.
 *
 * This route used to be a second, smaller screen over the same member
 * threads. Everything it did — read a member's thread, reply — lives at
 * /dashboard/messages, which also assigns, resolves and starts conversations.
 * Kept as a redirect so the sidebar link and any bookmark still arrive.
 */
export default function MemberSupportRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/messages");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner />
    </div>
  );
}
