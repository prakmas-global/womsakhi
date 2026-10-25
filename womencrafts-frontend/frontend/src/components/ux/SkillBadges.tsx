import * as Icons from "@/components/ux/icons";

/**
 * "Verified skill" badges — skills she proved by passing a WomSakhi skill test
 * (backend: app/core/skill_proof.py). Shown wherever someone decides whether
 * to trust her: her profile, her shop, her mentor card, her job applications.
 * Each links to the certificate, which anyone can check at /verify/<code>.
 */
export interface VerifiedSkill {
  skill: string;
  title: string;
  score: number;
  code: string;
}

export function SkillBadges({ skills, size = "md", link = true }: {
  skills?: VerifiedSkill[] | null;
  size?: "sm" | "md";
  /** Link each badge to its public certificate. */
  link?: boolean;
}) {
  if (!skills?.length) return null;
  const pad = size === "sm" ? "px-2 py-[2px] text-2xs" : "px-2.5 py-1 text-xs";
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {skills.map((s) => {
        const inner = (
          <>
            <Icons.BadgeCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.4} />
            Verified: {s.skill}
          </>
        );
        const cls = `inline-flex items-center gap-1 rounded-full font-semibold ${pad}`;
        const style = { background: "var(--ux-tint-green, #e8f4ec)", color: "var(--ux-green-ink, #007d38)" };
        const title = `${s.title} — passed with ${s.score}%`;
        return link && s.code ? (
          <a key={s.skill + s.title} href={`/verify/${s.code}`} target="_blank" rel="noopener noreferrer"
             className={`${cls} hover:underline`} style={style} title={`${title}. Check the certificate.`}>{inner}</a>
        ) : (
          <span key={s.skill + s.title} className={cls} style={style} title={title}>{inner}</span>
        );
      })}
    </span>
  );
}
