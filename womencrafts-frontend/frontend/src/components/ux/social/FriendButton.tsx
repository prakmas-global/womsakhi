"use client";

import { useConfirm } from "@/design-system/feedback/ConfirmProvider";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import type { Relation } from "@/lib/people-api";
import { apiAcceptFriend, apiAddFriend, apiCancelFriend, apiDeclineFriend, apiUnfriend } from "@/lib/social-api";

/**
 * One button for every state of a friendship: Add friend → Requested (tap to
 * cancel) → Accept / Decline when she asked first → Friends (tap to unfriend,
 * after a confirm). The state comes from the server row and is updated from
 * the server's answer, never guessed.
 */
export function FriendButton({ userId, relation, name, size = "sm", full, onChange }: {
  userId: string;
  relation: Relation;
  name: string;
  size?: "sm" | "md";
  full?: boolean;
  onChange?: (r: Relation) => void;
}) {
  const confirm = useConfirm();
  const [rel, setRel] = useState<Relation>(relation);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ relation: Relation }>, said?: string) => {
    setBusy(true);
    try {
      const s = await fn();
      setRel(s.relation);
      onChange?.(s.relation);
      if (said) toast(said, { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (rel === "self") return null;
  if (rel === "friends") {
    return (
      <Btn size={size} full={full} variant="soft" icon="UserCheck" loading={busy}
           onClick={async () => { if (await confirm({ title: `Remove ${name} from your friends?`, confirmLabel: "Remove friend", danger: true })) await run(() => apiUnfriend(userId), "Friend removed"); }}>
        Friends
      </Btn>
    );
  }
  if (rel === "sent") {
    return (
      <Btn size={size} full={full} variant="outline" icon="Clock" loading={busy}
           onClick={() => run(() => apiCancelFriend(userId), "Request cancelled")}>
        Requested
      </Btn>
    );
  }
  if (rel === "received") {
    return (
      <span className={`inline-flex gap-2 ${full ? "w-full" : ""}`}>
        <Btn size={size} full={full} icon="Check" loading={busy}
             onClick={() => run(() => apiAcceptFriend(userId), `You and ${name} are now friends`)}>
          Accept
        </Btn>
        <Btn size={size} full={full} variant="outline" disabled={busy} onClick={() => run(() => apiDeclineFriend(userId))}>
          Decline
        </Btn>
      </span>
    );
  }
  return (
    <Btn size={size} full={full} icon="UserPlus" loading={busy}
         onClick={() => run(() => apiAddFriend(userId), "Friend request sent")}>
      Add friend
    </Btn>
  );
}
