"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { usePathname } from "next/navigation";
import { ArrowLeft, Mail, Moon, ShieldCheck, Sun } from "lucide-react";
import AuthShowcase from "@/components/auth/AuthShowcase";
import LanguageMenu from "@/components/auth/LanguageMenu";
import { useTheme } from "@/context/ThemeContext";
import "./auth-tokens.css";

type InfoPanel = "terms" | "privacy" | "help" | "contact";

const INFO: Record<InfoPanel, { title: string; intro: string; points: string[] }> = {
  terms: {
    title: "Terms of use",
    intro: "A clear agreement for using WomSakhi safely and respectfully.",
    points: [
      "Use accurate account information and protect your sign-in details.",
      "Treat every member with dignity. Harassment, fraud, and exploitation are not allowed.",
      "Opportunities must be honest, lawful, and transparent about payment and expectations.",
      "We may restrict accounts that put members or the community at risk.",
    ],
  },
  privacy: {
    title: "Your privacy",
    intro: "Your information belongs to you. We collect only what is needed to run and protect your account.",
    points: [
      "Your password is encrypted and cannot be read by WomSakhi staff.",
      "Private identity documents are limited to authorised review team members.",
      "We do not sell your personal information or phone number.",
      "You can request access, correction, or deletion of your account information.",
    ],
  },
  help: {
    title: "Need help?",
    intro: "We will help you get back into your account or answer questions about joining.",
    points: [
      "Use Forgot password if you cannot remember your password.",
      "Check your spam folder if a verification or reset email does not arrive.",
      "Never share your password or one-time code with anyone.",
    ],
  },
  contact: {
    title: "Contact WomSakhi",
    intro: "A real person can help with account access, safety, verification, or general questions.",
    points: ["Email us at hello@womsakhi.com", "Include the email address used for your account.", "For your safety, never send a password or one-time code."],
  },
};

function InformationPanel({ panel, onBack }: { panel: InfoPanel; onBack: () => void }) {
  const tr = useT();
  const info = INFO[panel];
  return (
    <div className="auth-info-view" role="region" aria-live="polite">
      <button type="button" className="auth-info-back" onClick={onBack}><ArrowLeft aria-hidden /> Back</button>
      <div className="auth-info-icon">{panel === "contact" || panel === "help" ? <Mail aria-hidden /> : <ShieldCheck aria-hidden />}</div>
      <h1>{info.title}</h1>
      <p className="auth-info-intro">{info.intro}</p>
      <ul>{info.points.map((point) => <li key={point}>{point}</li>)}</ul>
      {(panel === "contact" || panel === "help") && <a className="auth-go auth-info-action" href="mailto:hello@womsakhi.com">{tr("layout.emailSupport")}</a>}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const tr = useT();
  const pathname = usePathname();
  const { isDark, setTheme } = useTheme();
  const [infoPanel, setInfoPanel] = useState<InfoPanel | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reset = window.setTimeout(() => {
      setInfoPanel(null);
      panelRef.current?.scrollTo({ top: 0 });
    });
    return () => window.clearTimeout(reset);
  }, [pathname]);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [infoPanel]);

  return (
    <main className="auth-scene auth-entry">
      <div className="auth-canvas" aria-hidden />

      <section className="auth-story" aria-label={tr("layout.womsakhiCommunity")}>
        <p className="auth-promise"><span>{tr("layout.differentWomen")}</span><br /><strong>{tr("layout.brighterTomorrows")}</strong></p>
        <p className="auth-values">{tr("layout.learnWorkEarnBelong")}</p>
        <AuthShowcase />
        <p className="auth-sisterhood">{tr("layout.aGlobalSisterhoodGrowingTogether")}</p>
      </section>

      <section className="auth-form-zone">
        <button type="button" className="auth-theme-toggle" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </button>
        {/* Was a pill that said "English" and did nothing. The one screen a
            woman who does not read English has to get through is the one
            screen that was written only in English. */}
        <LanguageMenu />

        <div className="auth-panel" ref={panelRef}>
          <div className="auth-panel-content" key={infoPanel ?? pathname}>
            {infoPanel ? <InformationPanel panel={infoPanel} onBack={() => setInfoPanel(null)} /> : children}
          </div>
          <footer className="auth-note">
            <button type="button" onClick={() => setInfoPanel("terms")}>Terms</button>
            <button type="button" onClick={() => setInfoPanel("privacy")}>Privacy</button>
            <button type="button" onClick={() => setInfoPanel("help")}>Help</button>
            <button type="button" onClick={() => setInfoPanel("contact")}>Contact</button>
          </footer>
        </div>
        <p className="auth-kindness">{tr("layout.moreWomen")}<br />{tr("layout.aKinderWorld")}</p>
      </section>

      <p className="auth-principles">SAFE&nbsp;&nbsp; • &nbsp;&nbsp;EMPOWERED&nbsp;&nbsp; • &nbsp;&nbsp;CONNECTED&nbsp;&nbsp; • &nbsp;&nbsp;LIMITLESS</p>
    </main>
  );
}
