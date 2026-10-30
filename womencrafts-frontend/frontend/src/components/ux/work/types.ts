"use client";

import { masterPicture, useMaster } from "@/lib/masters-api";
import { JOB_KINDS } from "@/lib/work-api";

/**
 * Types of work — the `opportunity_types` master (staff control it; backend
 * app/core/masters.py). The server stores and checks the label; these are the
 * friendlier words and icons the member screens show for the types the app
 * started with. A type staff add later shows under its own name.
 */
const LOOK: Record<string, { title: string; sub: string; icon: string }> = {
  Job: { title: "A job", sub: "Regular work", icon: "Briefcase" },
  Freelance: { title: "Freelance", sub: "Work as it comes", icon: "Sparkles" },
  "Craft order": { title: "Order to make", sub: "Pieces made for you", icon: "Package" },
  Internship: { title: "Internship", sub: "Learn on the job", icon: "GraduationCap" },
  Training: { title: "Training", sub: "You teach the work", icon: "Presentation" },
};

export function kindLook(label: string) {
  return LOOK[label] ?? { title: label, sub: "", icon: "Briefcase" };
}

/** Active type labels, in staff's order; the built-in five until the list loads. */
export function useOpportunityTypes(): string[] {
  return useMaster("opportunity_types", [...JOB_KINDS]).labels;
}

/**
 * The same types with their pictures: the one staff set on the master, else
 * the library picture the type's name points to.
 */
export function useOpportunityTypePictures(): Record<string, string> {
  const { items } = useMaster("opportunity_types", [...JOB_KINDS]);
  return Object.fromEntries(items.map((i) => [i.label, masterPicture("opportunity_types", i)]));
}
