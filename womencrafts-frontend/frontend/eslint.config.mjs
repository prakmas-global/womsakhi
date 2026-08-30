import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * An error, not the warning `eslint-config-next` ships.
       *
       * Ten screens in this app were built on the same defect and every one of
       * them passed lint. `useResource` hands back a mock fallback on the first
       * render and the real answer a moment later, so a `useMemo` that does not
       * list the data is computed once, from the fixture, and never again — and
       * the screen shows invented content for the whole session. The counts
       * gave it away, because they were computed outside the memo: the header
       * on /applications read the server's seven while the list under it showed
       * a job at a company that does not exist.
       *
       * It is not a style rule here. It is the rule that catches a screen
       * lying about her money, her applications and her events, and a warning
       * is a thing ten of them shipped past.
       *
       * Where the compiler cannot preserve a hand-written memo ("Existing
       * memoization could not be preserved"), the fix is to delete the memo and
       * let the compiler do it — see `src/app/app/documents/page.tsx` — not to
       * silence this line.
       */
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
