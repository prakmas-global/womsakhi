import { authSans, authSerif } from "@/components/auth-shell/fonts";
import "@/components/onboarding-flow/tokens.css";
import "@/components/onboarding-flow/onboarding.css";

/**
 * The flow runs outside the app shell, so it needs its own loading state:
 * the same cream frame the flow draws, with a quiet spinner — not the whole
 * app, sidebar and all, which she may not be able to reach yet.
 */
export default function Loading() {
  return (
    <div className={`wso wso-app ${authSerif.variable} ${authSans.variable}`}>
      <div className="wso-stage">
        <div className="wso-frame">
          <div className="wso-body wso-loading">
            <div className="wso-center-screen" role="status"><span className="wso-busy" aria-hidden /><p className="wso-sub">Opening your questions…</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
