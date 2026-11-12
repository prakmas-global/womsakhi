import { authSerif } from "@/components/auth-shell/fonts";
import { OPEN_CHECK } from "./open-check";
import AppSplashController from "./AppSplashController";
import "./app-splash.css";

/** A short, data-light welcome. The app never waits for a video to finish. */
export default function AppSplash() {
  return (
    <>
      <div className={`app-splash ${authSerif.variable}`} aria-hidden>
        <div className="app-splash-vid">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/womsakhi-reveal.jpg"
            alt=""
            width={576}
            height={576}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="app-splash-foot">
          <div className="app-splash-tagline">Stronger women · Brighter tomorrows</div>
          <div className="app-splash-loader" />
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: OPEN_CHECK }} />
      <AppSplashController />
    </>
  );
}
