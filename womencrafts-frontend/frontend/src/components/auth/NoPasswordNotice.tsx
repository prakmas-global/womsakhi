import Link from "next/link";

import { AuthIcon, AuthShell } from "@/components/auth-shell";

/**
 * What an old "forgot password" or "reset password" link lands on now.
 *
 * WomSakhi has no passwords any more — every sign-in is a one-time code — but
 * links from before still sit in inboxes. They should land somewhere that says
 * so and takes her straight to signing in, not on a 404. Plain panel, no
 * people photo: this is a calm refusal, not a welcome.
 */
export default function NoPasswordNotice() {
  return (
    <AuthShell
      photo="plain"
      caption={{ title: "No passwords at WomSakhi", text: "Every sign-in is a one-time code sent to your mobile or email, so there is nothing to forget, reset or steal." }}
    >
      <div className="wsa-okhero"><span><AuthIcon name="mail" /></span></div>
      <h1 className="wsa-t wsa-center">No password needed</h1>
      <p className="wsa-s wsa-center">
        WomSakhi no longer uses passwords — sign in with a code sent to your mobile or email.
        There is nothing to reset or remember.
      </p>
      <Link href="/signin" className="wsa-btn wsa-go">Sign in with a code <AuthIcon name="arrow" /></Link>
      <p className="wsa-link">
        Cannot reach your mobile or email any more? Write to{" "}
        <a href="mailto:support@womsakhi.com">support@womsakhi.com</a> and a person will help you back in.
      </p>
    </AuthShell>
  );
}
