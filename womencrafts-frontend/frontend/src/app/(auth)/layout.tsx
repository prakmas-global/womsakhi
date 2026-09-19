"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, Globe2, Mail, Moon, ShieldCheck, Sun } from "lucide-react";
import AuthShowcase from "@/components/auth/AuthShowcase";
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
    points: ["Email us at hello@womsakhi.in", "Include the email address used for your account.", "For your safety, never send a password or one-time code."],
  },
};

function InformationPanel({ panel, onBack }: { panel: InfoPanel; onBack: () => void }) {
  const info = INFO[panel];
  return (
    <div className="auth-info-view" role="region" aria-live="polite">
      <button type="button" className="auth-info-back" onClick={onBack}><ArrowLeft aria-hidden /> Back</button>
      <div className="auth-info-icon">{panel === "contact" || panel === "help" ? <Mail aria-hidden /> : <ShieldCheck aria-hidden />}</div>
      <h1>{info.title}</h1>
      <p className="auth-info-intro">{info.intro}</p>
      <ul>{info.points.map((point) => <li key={point}>{point}</li>)}</ul>
      {(panel === "contact" || panel === "help") && <a className="auth-go auth-info-action" href="mailto:hello@womsakhi.in">Email support</a>}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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

      <section className="auth-story" aria-label="WomSakhi community">
        <p className="auth-promise"><span>Different Women.</span><br /><strong>Brighter Tomorrows.</strong></p>
        <p className="auth-values">Learn • Work • Earn • Belong</p>
        <AuthShowcase />
        <p className="auth-sisterhood">A global sisterhood, growing together.</p>
      </section>

      <section className="auth-form-zone">
        <button type="button" className="auth-theme-toggle" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </button>
        <button type="button" className="auth-language" aria-label="Choose language">
          <Globe2 aria-hidden /> <span>English</span> <ChevronDown aria-hidden />
        </button>

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
        <p className="auth-kindness">More Women<br />A Kinder World ♡</p>
      </section>

      <p className="auth-principles">SAFE&nbsp;&nbsp; • &nbsp;&nbsp;EMPOWERED&nbsp;&nbsp; • &nbsp;&nbsp;CONNECTED&nbsp;&nbsp; • &nbsp;&nbsp;LIMITLESS</p>
    </main>
  );
}
