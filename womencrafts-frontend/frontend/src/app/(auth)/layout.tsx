import { SPLASH_KEY } from "@/components/auth-shell/splash-key";

/**
 * A thin wrapper: each auth screen picks its own photo, so the shell
 * (`@/components/auth-shell`) is rendered by the page, not here.
 *
 * The one thing that must happen before first paint lives here: if this
 * browser session has already seen the splash, mark <html> so the splash in
 * the server HTML never flashes. Storage that throws simply leaves it to show
 * (it fades itself out after 2.5 s either way).
 */
const SEEN_CHECK = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_KEY)}))document.documentElement.setAttribute("data-wsa-splash","seen")}catch(e){}`;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SEEN_CHECK }} />
      {children}
    </>
  );
}
