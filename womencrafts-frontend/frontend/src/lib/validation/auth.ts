import { z } from "zod";

import { declaration, email, fullName, indianMobile, sixDigitCode } from "./fields";

/** Sign in with email. */
export const signinEmailSchema = z.object({ email });
/** Sign in with mobile. */
export const signinMobileSchema = z.object({ mobile: indianMobile });
/** Join, step 1. */
export const joinContactSchema = z.object({ email, mobile: indianMobile });
/** Join, step 3. */
export const joinAboutSchema = z.object({ fullName, declaration });
/** Any 6-digit code (email, SMS, authenticator). */
export const codeSchema = z.object({ code: sixDigitCode });
/** Confirm or change her mobile. */
export const phoneSchema = z.object({ mobile: indianMobile });

export type SigninEmail = z.infer<typeof signinEmailSchema>;
export type SigninMobile = z.infer<typeof signinMobileSchema>;
export type JoinContact = z.infer<typeof joinContactSchema>;
export type JoinAbout = z.infer<typeof joinAboutSchema>;
