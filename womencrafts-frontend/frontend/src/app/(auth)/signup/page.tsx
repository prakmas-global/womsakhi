"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight, Camera, Check, Eye, EyeOff, FileImage, Loader2,
  Lock, Mail, Phone, ShieldCheck, Sparkles, Upload, UserRound, X,
} from "lucide-react";

import { BrandLockup } from "@/components/brand/BrandLockup";
import { CountryPicker } from "@/components/auth/CountryPicker";
import { useI18n, useT } from "@/i18n";
import { apiErrorMessage, apiSubmitSignupApplication } from "@/lib/api";
import { normalizePhone, PHONE_COUNTRIES } from "@/lib/phone";
import { MAX_DOCUMENT_MB, validateDocument } from "@/lib/verification-api";

type DocumentFieldProps = {
  title: string;
  note: string;
  file: File | null;
  accept: string;
  facing: "user" | "environment";
  error?: string;
  onChange: (file: File | null) => void;
};

function DocumentField({ title, note, file, accept, facing, error, onChange }: DocumentFieldProps) {
  const camera = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => file && file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    [file],
  );
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const take = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (selected) onChange(selected);
  };

  return (
    <div className={`auth-application-document rounded-[16px] border p-3.5${error ? " auth-document-invalid" : ""}`}>
      <input ref={camera} type="file" accept="image/*" capture={facing} className="sr-only" onChange={take} aria-label={`Take ${title}`} />
      <input ref={files} type="file" accept={accept} className="sr-only" onChange={take} aria-label={`Choose ${title}`} />
      <div className="flex items-start gap-3">
        <div className="auth-application-thumb grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : file ? <FileImage className="h-5 w-5" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--a-ink)" }}>{title}</p>
            {file && <span className="auth-application-added inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"><Check className="h-3 w-3" /> Added</span>}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--a-muted)" }}>{note}</p>
          {file && <p className="mt-1 truncate text-[11px] font-medium" style={{ color: "var(--a-ink-2)" }}>{file.name}</p>}
        </div>
        {file && (
          <button type="button" onClick={() => onChange(null)} className="auth-application-remove grid h-9 w-9 shrink-0 place-items-center rounded-xl" aria-label={`Remove ${title}`}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => camera.current?.click()} className="auth-application-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold">
          <Camera className="h-4 w-4" /> {file ? "Retake" : "Take photo"}
        </button>
        <button type="button" onClick={() => files.current?.click()} className="auth-application-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold">
          <Upload className="h-4 w-4" /> {file ? "Replace" : "Choose file"}
        </button>
      </div>
      {error && <p role="alert" className="auth-field-message mt-2">{error}</p>}
    </div>
  );
}

type SignupErrors = Partial<Record<
  "fullName" | "email" | "country" | "phone" | "password" | "identityDocument" | "selfie",
  string
>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordIssue(value: string): string {
  if (!value) return "Create a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (new TextEncoder().encode(value).length > 72) return "Use a password shorter than 72 bytes.";
  if (!/\p{L}/u.test(value) || !/\d/.test(value) || !/[^\p{L}\d\s]/u.test(value)) {
    return "Include at least one letter, one number and one symbol.";
  }
  return "";
}

export default function SignUpPage() {
  const tr = useT();
  const { locale } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identityDocument, setIdentityDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = Math.min(100,
    (password.length >= 8 ? 40 : password.length * 5) +
    (/[A-Z]/.test(password) ? 20 : 0) +
    (/[0-9]/.test(password) ? 20 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 20 : 0));
  const strengthLabel = !password ? "" : strength >= 70 ? "Strong" : strength >= 40 ? "Getting there" : "Too weak";
  const strengthInk = strength >= 70 ? "var(--a-ok)" : strength >= 40 ? "var(--a-warn)" : "var(--a-bad)";

  const setDocument = (kind: "id" | "selfie", file: File | null) => {
    const key = kind === "id" ? "identityDocument" : "selfie";
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (file) {
      const issue = validateDocument(file);
      if (issue) { setErrors((current) => ({ ...current, [key]: issue })); return; }
      const imageByName = /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (kind === "selfie" && !file.type.startsWith("image/") && !imageByName) {
        setErrors((current) => ({ ...current, selfie: "Your selfie must be a JPG, PNG, WEBP or HEIC image." }));
        return;
      }
    }
    if (kind === "id") setIdentityDocument(file); else setSelfie(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const nextErrors: SignupErrors = {};
    if (!fullName.trim()) nextErrors.fullName = "Enter your full name.";
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!country) nextErrors.country = "Select your country.";
    const normalizedPhone = normalizePhone(phone, country);
    if (!phone.trim()) nextErrors.phone = "Enter your mobile number.";
    else if (country && !normalizedPhone) nextErrors.phone = "Enter a valid mobile number for the selected country.";
    const passwordError = passwordIssue(password);
    if (passwordError) nextErrors.password = passwordError;
    if (!identityDocument) nextErrors.identityDocument = "Add one clear photo of your government ID.";
    if (!selfie) nextErrors.selfie = "Add a clear selfie while holding the same ID.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setError("Please complete the highlighted fields before submitting.");
      const first = Object.keys(nextErrors)[0] as keyof SignupErrors;
      const ids: Record<keyof SignupErrors, string> = {
        fullName: "su-name", email: "su-email", country: "su-country", phone: "su-phone",
        password: "su-password", identityDocument: "su-id-section", selfie: "su-selfie-section",
      };
      window.requestAnimationFrame(() => document.getElementById(ids[first])?.focus());
      return;
    }
    setErrors({}); setLoading(true);
    try {
      await apiSubmitSignupApplication({
        full_name: fullName.trim(), email: email.trim().toLowerCase(), password, phone: normalizedPhone!,
        country, locale, identity_document: identityDocument!, selfie: selfie!,
      });
      window.location.assign("/app/verify?submitted=1");
    } catch (cause) {
      const message = apiErrorMessage(cause, "We could not create your account. Check the details and try again.");
      const lower = message.toLowerCase().replaceAll("_", " ");
      if (lower.includes("email") || lower.includes("account") && lower.includes("exists")) {
        setErrors((current) => ({ ...current, email: message }));
        document.getElementById("su-email")?.focus();
      } else if (lower.includes("full name")) {
        setErrors((current) => ({ ...current, fullName: message }));
        document.getElementById("su-name")?.focus();
      } else if (lower.includes("password")) {
        setErrors((current) => ({ ...current, password: message }));
        document.getElementById("su-password")?.focus();
      } else if (lower.includes("mobile") || lower.includes("phone")) {
        setErrors((current) => ({ ...current, phone: message }));
        document.getElementById("su-phone")?.focus();
      } else if (lower.includes("country")) {
        setErrors((current) => ({ ...current, country: message }));
        document.getElementById("su-country")?.focus();
      } else {
        setError(message);
      }
    } finally { setLoading(false); }
  };

  const field = "auth-field min-h-[46px] w-full rounded-[12px] pe-4 ps-11 text-sm";
  const label = "mb-1.5 block text-xs font-semibold";
  const icon = "pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2";

  return (
    <div className="auth-application">
      <div className="flex items-center justify-between gap-4">
        <BrandLockup alt={tr("waitScreen.womsakhiStrongerWomenBrighterTomorrows")} className="h-12 w-[92px] object-contain" />
        <div className="auth-application-one-step rounded-full px-3 py-1.5 text-[11px] font-bold"><Sparkles className="me-1 inline h-3.5 w-3.5" />One secure application</div>
      </div>
      <h1 className="mt-1 text-start font-bold leading-tight tracking-tight" style={{ color: "var(--a-ink)", fontSize: "clamp(1.55rem,2.5vw,2.1rem)" }}>Create your WomSakhi account</h1>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--a-muted)" }}>Complete one secure form with your contact details, one photo ID and one selfie. We submit it directly to our authorised review team.</p>

      {error && <p role="alert" className="auth-application-error mt-4 rounded-xl px-3.5 py-3 text-xs leading-relaxed">{error}</p>}

      <form onSubmit={submit} className="mt-3" noValidate>
        <div className="auth-application-columns grid gap-4">
          <section className="auth-application-section auth-application-account rounded-[18px] border p-4">
            <div className="mb-3 flex items-center gap-2"><span className="auth-section-icon grid h-8 w-8 place-items-center rounded-xl"><UserRound className="h-4 w-4" /></span><div><h2 className="text-sm font-bold">Your account details</h2><p className="text-[11px]" style={{ color: "var(--a-muted)" }}>The essentials we need to create your secure account.</p></div></div>
            <div className="auth-account-grid grid gap-3">
              <div><label htmlFor="su-name" className={label}>Full name *</label><div className="relative"><UserRound className={icon} /><input id="su-name" autoFocus autoComplete="name" value={fullName} onChange={(e) => { setFullName(e.target.value); setErrors((current) => ({ ...current, fullName: undefined })); setError(""); }} className={`${field}${errors.fullName ? " auth-field-invalid" : ""}`} placeholder="Your full name" aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "su-name-error" : undefined} /></div>{errors.fullName && <p id="su-name-error" role="alert" className="auth-field-message">{errors.fullName}</p>}</div>
              <div><label htmlFor="su-email" className={label}>Email address *</label><div className="relative"><Mail className={icon} /><input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((current) => ({ ...current, email: undefined })); setError(""); }} className={`${field}${errors.email ? " auth-field-invalid" : ""}`} placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? "su-email-error" : undefined} /></div>{errors.email && <p id="su-email-error" role="alert" className="auth-field-message">{errors.email}</p>}</div>
              <div><label htmlFor="su-country" className={label}>Country and mobile number *</label><div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]"><div><CountryPicker value={country} onChange={(value) => { setCountry(value); setErrors((current) => ({ ...current, country: undefined, phone: undefined })); setError(""); }} describedBy={errors.country ? "su-country-error" : undefined} invalid={!!errors.country} />{errors.country && <p id="su-country-error" role="alert" className="auth-field-message">{errors.country}</p>}</div><div><div className="relative"><Phone className={icon} /><input id="su-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((current) => ({ ...current, phone: undefined })); setError(""); }} className={`${field}${errors.phone ? " auth-field-invalid" : ""}`} placeholder={country ? `Mobile number (${PHONE_COUNTRIES.find((item) => item.code === country)?.dial})` : "Select country first"} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "su-phone-error" : undefined} /></div>{errors.phone && <p id="su-phone-error" role="alert" className="auth-field-message">{errors.phone}</p>}</div></div></div>
              <div><label htmlFor="su-password" className={label}>Create a password *</label><div className="relative"><Lock className={icon} /><input id="su-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((current) => ({ ...current, password: undefined })); setError(""); }} className={`${field} pe-12${errors.password ? " auth-field-invalid" : ""}`} placeholder="8+ chars, number & symbol" aria-invalid={!!errors.password} aria-describedby={errors.password ? "su-password-error" : "su-password-help"} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.password && <p id="su-password-error" role="alert" className="auth-field-message">{errors.password}</p>}{strengthLabel && <div id="su-password-help" className="mt-2 flex items-center gap-2"><span className="auth-application-track h-1 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full" style={{ width: `${strength}%`, background: strengthInk }} /></span><span className="text-[10px] font-bold" style={{ color: strengthInk }}>{strengthLabel}</span></div>}</div>
            </div>
          </section>

          <section className="auth-application-section auth-application-identity rounded-[18px] border p-4">
            <div className="mb-1 flex items-center gap-2"><span className="auth-section-icon grid h-8 w-8 place-items-center rounded-xl"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold">Identity check</h2><p className="text-[11px] leading-relaxed" style={{ color: "var(--a-muted)" }}>Two clear images complete your application. Maximum {MAX_DOCUMENT_MB} MB each.</p></div></div>
            <div className="auth-document-grid mt-3 grid gap-3">
              <div id="su-id-section" tabIndex={-1}><DocumentField title="Photo ID" note="Aadhaar, voter card or driving licence" file={identityDocument} accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" facing="environment" error={errors.identityDocument} onChange={(file) => { setDocument("id", file); setError(""); }} /></div>
              <div id="su-selfie-section" tabIndex={-1}><DocumentField title="Selfie with the same ID" note="Keep your face and the ID clear in the frame" file={selfie} accept="image/jpeg,image/png,image/webp,image/heic" facing="user" error={errors.selfie} onChange={(file) => { setDocument("selfie", file); setError(""); }} /></div>
            </div>
          </section>
        </div>

        <div className="auth-application-trust mt-4 rounded-[14px] p-3"><ShieldCheck className="h-4 w-4 shrink-0" /><p className="text-[11px] leading-relaxed"><strong>Admin review only.</strong> Your application is submitted automatically; there is no second verification request to send.</p></div>
        <button type="submit" disabled={loading} className="auth-go mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-bold">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{loading ? "Encrypting and submitting…" : "Create account & submit application"}{!loading && <ArrowRight className="h-5 w-5" />}
        </button>
      </form>
      <p className="mt-4 text-center text-xs" style={{ color: "var(--a-muted)" }}>Already have an account? <Link href="/signin" className="auth-link font-bold">Sign in</Link></p>
    </div>
  );
}
