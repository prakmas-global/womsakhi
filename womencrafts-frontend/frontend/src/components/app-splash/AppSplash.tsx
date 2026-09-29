import { authSerif } from "@/components/auth-shell/fonts";
import { OPEN_CHECK } from "./open-check";
import AppSplashController from "./AppSplashController";
import "./app-splash.css";

/**
 * S1 — the opening moment: the whole 6 s logo reveal, every time she opens
 * the app (a new launch, or back after a while away). Not on page moves.
 *
 * The markup is always in the page and hidden by CSS; the inline script right
 * after it switches it on before first paint when this is an app open, and
 * starts the video. The controller takes it from there and closes it on the
 * video's last frame. Without JavaScript nothing shows, which is fine.
 */
export default function AppSplash() {
  return (
    <>
      <div className={`app-splash ${authSerif.variable}`} aria-hidden>
        <div className="app-splash-vid">
          <video
            id="app-splash-video"
            src="/womsakhi-reveal.mp4"
            poster="/womsakhi-reveal.jpg"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
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
