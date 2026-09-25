"use client";

import { ForYou } from "@/components/ux/cycle/ForYou";

import { useT } from "@/i18n";
/** Mental Wellness — "For you today", opened on its own tab. See components/ux/cycle/ForYou.tsx. */
export default function Page() {
  const tr = useT();
  return <ForYou initial="mind" title={tr("healthMind.mentalWellness")} />;
}
