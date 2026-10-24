"use client";

import { useState } from "react";

import { NoteBtn } from "@/components/ux/kit";
import { apiStartConversation } from "@/lib/me-messages-api";
import { apiErrorMessage } from "@/lib/api";

/**
 * "Message her" — a real thread with one member.
 *
 * About ten buttons across the app opened the general inbox and stopped
 * there. This one writes to her (POST /me/conversations/start): she gets it in
 * her inbox and a notification, and the confirmation links straight into the
 * conversation. Tap-to-add `phrases` keep typing to a minimum.
 */
export function MessageHer({
  userId, name, about = "", phrases = [], label = "Message her",
  variant = "outline", size = "sm", icon = "MessageCircle", full, placeholder,
}: {
  userId: string;
  /** Her name, as shown on the button's box ("Message Sunita"). */
  name: string;
  /** What it is about — shown under her name in both inboxes. */
  about?: string;
  phrases?: string[];
  label?: string;
  variant?: "primary" | "soft" | "outline" | "ghost";
  size?: "sm" | "md";
  icon?: string;
  full?: boolean;
  placeholder?: string;
}) {
  const [convId, setConvId] = useState("");
  const first = name.split(" ")[0] || "her";
  return (
    <NoteBtn
      label={label}
      icon={icon}
      variant={variant}
      size={size}
      full={full}
      title={`Message ${first}`}
      to={first}
      placeholder={placeholder ?? `Write to ${first}…`}
      phrases={phrases}
      send={async (n) => {
        try {
          const c = await apiStartConversation(userId, n.text, about);
          setConvId(c.id);
        } catch (e) {
          throw new Error(apiErrorMessage(e, "That did not reach her. Try again in a moment."));
        }
      }}
      sent={`Sent to ${first}`}
      sentBody="She will see it in her messages. Her reply comes to yours."
      sentLink={{ href: convId ? `/app/messages?c=${convId}` : "/app/messages", label: "Open the conversation" }}
    />
  );
}
