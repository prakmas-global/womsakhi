import { z } from "zod";

/**
 * The field rules every form in the app shares. The server checks the same
 * things (app/routes/auth.py); these are here so she hears about a slip next
 * to the field, at once, in words she can act on.
 */

export const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254, "That email address is too long")
  .pipe(z.email("Enter a valid email address, like name@gmail.com"))
  .transform((v) => v.toLowerCase());

/** 10 digits, Indian mobile (starts 6–9). Spaces and a +91 / 0 prefix are forgiven. */
export const indianMobile = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, ""))
  .pipe(
    z.string()
      .min(1, "Enter your mobile number")
      .regex(/^\d+$/, "Use digits only")
      .length(10, "Enter all 10 digits of your mobile number")
      .regex(/^[6-9]/, "Indian mobile numbers start with 6, 7, 8 or 9"),
  );

/** Letters in any script (Telugu, Hindi, English…), spaces, and . ' - between words. */
export const fullName = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(
    z.string()
      .min(2, "Enter your full name")
      .max(80, "Keep your name under 80 characters")
      .regex(/^[\p{L}\p{M}]+(?:[ .'’-]+[\p{L}\p{M}]+)*\.?$/u, "Use letters only — no numbers or symbols"),
  );

export const sixDigitCode = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(6, "Enter all 6 digits"));

/** A tick box she must tick. A boolean (not `literal(true)`) so a form can start unticked. */
export const declaration = z.boolean().refine((v) => v, { message: "Please confirm this to continue" });

/** A staff recovery code as printed: two groups of four, e.g. AB12-CD34. */
export const recoveryCode = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[0-9A-F]{8}$/, "Enter one of your recovery codes, like AB12-CD34"))
  .transform((v) => `${v.slice(0, 4)}-${v.slice(4)}`);
