import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * The 404 for everything outside the member app — public pages, sign-in, and
 * any URL that matches no route at all.
 *
 * Deliberately does not use the member kit: this renders for signed-out
 * visitors too, where the app shell and its tokens are not the right frame.
 * It leans on the design-system classes the public pages already use.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
        <Compass className="h-8 w-8" strokeWidth={1.8} />
      </span>

      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">
        We could not find that page
      </h1>
      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-subtle">
        The link may be out of date, or the page may have moved. Nothing is wrong with your
        account.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Go to the home page</Link>
        <Link href="/app" className="btn btn-secondary">Open WomSakhi</Link>
      </div>
    </main>
  );
}
