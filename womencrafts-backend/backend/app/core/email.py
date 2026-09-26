"""
Outbound email.

WomSakhi needs to email people at the moments that decide whether they trust us:
"confirm your address", "we're reviewing your documents", "you're in".

No provider is configured yet, so this ships with a **file adapter** that writes
each message to `outbox/` instead of sending it — development works end to end,
nothing silently disappears, and no half-finished credential ends up mailing
real people by accident. Set SMTP_HOST (and friends) in .env and the SMTP
adapter takes over with no code change.
"""

from __future__ import annotations

import json
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path
from typing import Optional

from app.core.config import settings

OUTBOX = Path(__file__).resolve().parents[2] / "outbox"


class EmailMessageSpec:
    """A message to send, independent of how it gets sent."""

    def __init__(self, to: str, subject: str, html: str, text: str):
        self.to = to
        self.subject = subject
        self.html = html
        self.text = text


class EmailProvider:
    name = "base"

    async def send(self, message: EmailMessageSpec) -> bool:  # pragma: no cover - interface
        raise NotImplementedError


class FileEmailProvider(EmailProvider):
    """
    Development adapter: writes the email to disk instead of sending it.

    Each message lands in `outbox/` as a .json (metadata) and .html (previewable
    in a browser), so the whole flow can be tested without a mail account.
    """

    name = "file"

    async def send(self, message: EmailMessageSpec) -> bool:
        OUTBOX.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        safe_to = message.to.replace("@", "_at_").replace("/", "_")
        # NB: build the names by concatenation. `with_suffix` would treat the
        # ".com" in the address as a file extension and truncate the name.
        stem = f"{stamp}-{safe_to}"
        (OUTBOX / f"{stem}.html").write_text(message.html, encoding="utf-8")
        (OUTBOX / f"{stem}.json").write_text(
            json.dumps(
                {
                    "to": message.to,
                    "subject": message.subject,
                    "text": message.text,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"📧 [outbox] '{message.subject}' → {message.to}  ({stem}.html)")
        return True


class SmtpEmailProvider(EmailProvider):
    """Real delivery over SMTP — works with SES, SendGrid, Resend, Gmail, etc."""

    name = "smtp"

    async def send(self, message: EmailMessageSpec) -> bool:
        msg = EmailMessage()
        msg["Subject"] = message.subject
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
        msg["To"] = message.to
        msg.set_content(message.text)
        msg.add_alternative(message.html, subtype="html")

        try:
            if settings.SMTP_USE_SSL:
                server = smtplib.SMTP_SSL(
                    settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context()
                )
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            with server:
                if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                    server.starttls(context=ssl.create_default_context())
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            return True
        except Exception as exc:  # noqa: BLE001 - a mail outage must not 500 a signup
            print(f"⚠️  Email to {message.to} failed: {exc}")
            return False


class MailgunEmailProvider(EmailProvider):
    """
    Mailgun's HTTP API.

    Preferred over SMTP for this product for one practical reason: Cloud Run
    egress on port 587 is unreliable and slow to diagnose, while an HTTPS POST
    is the one thing that always works from a container.

    ── The sandbox trap, which is why `can_deliver` is not just a key check ───
    A Mailgun *sandbox* domain (`sandbox….mailgun.org`) delivers ONLY to
    recipients that have been added and confirmed in the Mailgun dashboard, and
    refuses every other address with a 400. Configured against a sandbox, this
    provider is genuinely working and a real woman still gets nothing — which
    is exactly the failure this codebase has already had once, over a file
    adapter that returned True. So `can_deliver()` below treats a sandbox
    domain as "not delivering", and the screens keep saying so until the domain
    is a verified one.

    ── Failure is reported, never swallowed ──────────────────────────────────
    Returns False and logs the status and body on anything other than a 2xx.
    A caller that believes a message was sent is worse than one that knows it
    was not.
    """

    name = "mailgun"

    async def send(self, message: EmailMessageSpec) -> bool:
        import httpx

        url = f"{settings.MAILGUN_BASE_URL.rstrip('/')}/v3/{settings.MAILGUN_DOMAIN}/messages"
        data = {
            "from": settings.EMAIL_FROM,
            "to": message.to,
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(url, auth=("api", settings.MAILGUN_API_KEY), data=data)
        except Exception as exc:  # network, DNS, TLS
            print(f"✉️  mailgun: could not reach the API — {exc}")
            return False

        if res.status_code // 100 == 2:
            return True

        # The body carries the reason, and the reason is usually the sandbox
        # one: "Sandbox subdomains are for test purposes only. Please add your
        # own domain or add the address to authorized recipients."
        print(f"✉️  mailgun: refused with {res.status_code} — {res.text[:300]}")
        return False


def get_provider() -> EmailProvider:
    """
    Mailgun, then SMTP, then the file adapter.

    `EMAIL_PROVIDER` forces one when it is set; left empty this picks whatever
    is actually configured, so adding a key is enough to switch a developer
    over without editing anything else.
    """
    forced = settings.EMAIL_PROVIDER.strip().lower()
    if forced == "file":
        return FileEmailProvider()
    if forced == "mailgun" or (not forced and _mailgun_configured()):
        if _mailgun_configured():
            return MailgunEmailProvider()
        # Asked for Mailgun without the keys. Fall through rather than throw:
        # a misconfiguration should degrade to "written to disk", never to a
        # 500 on the signup path.
        print("✉️  EMAIL_PROVIDER=mailgun but MAILGUN_API_KEY/DOMAIN are empty")
    if forced == "smtp" or settings.SMTP_HOST:
        if settings.SMTP_HOST:
            return SmtpEmailProvider()
        print("✉️  EMAIL_PROVIDER=smtp but SMTP_HOST is empty")
    return FileEmailProvider()


def _mailgun_configured() -> bool:
    return bool(settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN)


def is_sandbox_domain() -> bool:
    """
    A Mailgun sandbox domain reaches only addresses authorised in the
    dashboard. Everyone else is refused with a 400, which from a woman's side
    is indistinguishable from nothing having been sent.
    """
    return "sandbox" in settings.MAILGUN_DOMAIN.lower()


def can_deliver() -> bool:
    """
    Whether a message we "send" actually leaves this machine.

    The file adapter is the right default for development, but it is silent in
    exactly the wrong way: `send()` returns True, the caller believes the woman
    has been written to, and the message sits in `outbox/` forever. The
    forgot-password screen told a woman locked out of her account that a reset
    link was on its way, over 295 undelivered files.

    Callers that promise a person something arrives must ask this first and say
    something else when it is False.
    """
    provider = get_provider()
    if provider.name == "mailgun":
        # Configured, but a sandbox domain only reaches a handful of addresses
        # somebody added by hand. For the woman this function exists to protect
        # that is the same as not being able to send, so it answers no until
        # the domain is a verified one.
        #
        # `EMAIL_TEST_MODE` overrides that while you are testing the flow
        # against your own authorised address — see the note on the setting.
        # It does not make anyone else reachable; Mailgun still refuses them.
        if is_sandbox_domain():
            return bool(settings.EMAIL_TEST_MODE)
        return True
    if provider.name == "smtp":
        return bool(settings.SMTP_HOST)
    return False


# --- templates ---------------------------------------------------------------

def _wrap(
    title: str,
    body_html: str,
    cta_label: str = "",
    cta_url: str = "",
    *,
    preheader: str = "A message from WomSakhi",
    footer_note: str = "You received this message because your email address is connected to WomSakhi.",
) -> str:
    """Render the shared, responsive WomSakhi transactional-email shell.

    Email clients remove modern application CSS, so the layout deliberately
    uses presentation tables and inline styles. Every URL rendered here is an
    absolute production URL; the action is also printed below the button for
    people whose mail client blocks buttons or images.
    """
    app_url = settings.APP_BASE_URL.rstrip("/")
    logo_url = f"{app_url}/womsakhi-email-logo.png"
    safe_title = escape(title)
    safe_preheader = escape(preheader)
    safe_footer = escape(footer_note)
    safe_cta_label = escape(cta_label)
    safe_cta_url = escape(cta_url, quote=True)
    cta = (
        f"""
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 40px 8px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#c21868"
                 style="border-radius:12px;background:#c21868;box-shadow:0 6px 16px rgba(194,24,104,.18);">
            <a href="{safe_cta_url}" style="display:inline-block;border:1px solid #c21868;border-radius:12px;
               color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:20px;
               padding:14px 24px;">{safe_cta_label}</a>
          </td></tr></table>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 40px 26px;font-size:12px;line-height:18px;color:#766b80;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          If the button does not open, copy and paste this link into your browser:<br>
          <a href="{safe_cta_url}" style="color:#7a2c82;text-decoration:underline;word-break:break-all;">{safe_cta_url}</a>
        </td></tr>"""
        if cta_label and cta_url
        else ""
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{safe_title}</title>
</head><body style="margin:0;padding:0;background:#f7eef4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{safe_preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7eef4" style="background:#f7eef4;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:28px 14px;">
        <tr><td bgcolor="#4b174f" style="height:8px;background:#4b174f;border-radius:20px 20px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" bgcolor="#fffafc" style="background:#fffafc;padding:26px 32px 22px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          <a href="{escape(app_url, quote=True)}" style="text-decoration:none;">
            <img src="{escape(logo_url, quote=True)}" width="210" alt="WomSakhi" style="display:block;width:210px;max-width:100%;height:auto;border:0;">
          </a>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#8a4a86;text-transform:uppercase;margin-top:8px;">Together, women thrive</div>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:30px 40px 10px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          <h1 style="margin:0;font-size:25px;line-height:33px;color:#35123d;font-weight:750;letter-spacing:-.3px;">{safe_title}</h1>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background:#ffffff;font-size:15px;line-height:24px;color:#514658;padding:4px 40px 18px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">{body_html}</td></tr>
        {cta}
        <tr><td bgcolor="#fffafc" style="background:#fffafc;border:1px solid #eadde6;border-top:0;border-radius:0 0 20px 20px;padding:22px 40px;font-size:12px;line-height:18px;color:#807486;">
          {safe_footer}<br><br>
          <a href="{escape(app_url, quote=True)}" style="color:#7a2c82;text-decoration:none;font-weight:700;">Open WomSakhi</a>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="{escape(app_url + '/contact', quote=True)}" style="color:#7a2c82;text-decoration:none;">Contact support</a>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="{escape(app_url + '/privacy', quote=True)}" style="color:#7a2c82;text-decoration:none;">Privacy</a>
          <br><span style="color:#a397a7;">WomSakhi · India</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def verification_email(name: str, url: str) -> EmailMessageSpec:
    first = escape((name or "").strip().split(" ")[0] or "there")
    html = _wrap(
        "Confirm your email address",
        f"<p>Hi {first},</p><p>Welcome to WomSakhi. Please confirm this is your email "
        f"address so we can keep your account secure.</p>"
        f"<p style='font-size:13px;color:#8b849e;'>This link expires in "
        f"{settings.EMAIL_TOKEN_HOURS} hours.</p>",
        "Confirm my email",
        url,
        preheader="Confirm your email to continue your WomSakhi application.",
        footer_note="If you did not create this application, you can safely ignore this email.",
    )
    text = f"Hi {first},\n\nConfirm your WomSakhi email address:\n{url}\n\nThis link expires in {settings.EMAIL_TOKEN_HOURS} hours."
    return EmailMessageSpec(to="", subject="Confirm your WomSakhi email", html=html, text=text)


def submitted_email(name: str) -> EmailMessageSpec:
    first = escape((name or "").strip().split(" ")[0] or "there")
    html = _wrap(
        "We've received your documents",
        f"<p>Hi {first},</p><p>Thank you. Our team is reviewing your application now. "
        f"Because WomSakhi is a women-only community, every account is checked by a "
        f"real person — it usually takes 1–2 working days.</p>"
        f"<p>We'll email you the moment it's done.</p>",
        "View application status",
        f"{settings.APP_BASE_URL.rstrip('/')}/app/verify",
        preheader="Your documents reached the WomSakhi review team.",
        footer_note="This is a status update for your WomSakhi application.",
    )
    text = f"Hi {first},\n\nWe've received your documents. Our team reviews every account by hand; this usually takes 1-2 working days."
    return EmailMessageSpec(to="", subject="WomSakhi — your application is being reviewed", html=html, text=text)


def approved_email(name: str, url: str) -> EmailMessageSpec:
    first = escape((name or "").strip().split(" ")[0] or "there")
    html = _wrap(
        "You're in 🎉",
        f"<p>Hi {first},</p><p>Your WomSakhi account has been approved. You can now book "
        f"sessions, join programs and message our team.</p>",
        "Open WomSakhi",
        url,
        preheader="Your WomSakhi membership is approved and ready.",
        footer_note="This approval was completed by an authorised WomSakhi administrator.",
    )
    text = f"Hi {first},\n\nYour WomSakhi account has been approved. Sign in: {url}"
    return EmailMessageSpec(to="", subject="Your WomSakhi account is approved", html=html, text=text)


def rejected_email(name: str, reason: str) -> EmailMessageSpec:
    first = escape((name or "").strip().split(" ")[0] or "there")
    detail = f"<p><strong>Reason:</strong> {escape(reason)}</p>" if reason else ""
    html = _wrap(
        "We couldn't verify your account",
        f"<p>Hi {first},</p><p>We weren't able to verify your account with the documents "
        f"provided.</p>{detail}<p>You can reply to this email and our team will help you "
        f"sort it out.</p>",
        "Contact support",
        f"{settings.APP_BASE_URL.rstrip('/')}/contact",
        preheader="An update about your WomSakhi application.",
        footer_note="This is a status update for your WomSakhi application.",
    )
    text = f"Hi {first},\n\nWe couldn't verify your account. {reason}"
    return EmailMessageSpec(to="", subject="WomSakhi — about your application", html=html, text=text)


def reset_email(name: str, url: str, by_staff: bool = False) -> EmailMessageSpec:
    """
    A password reset link.

    When a staff member starts it we say so explicitly — an unexplained reset
    email is indistinguishable from a phishing attempt.
    """
    who = (
        "Someone on the WomSakhi team started a password reset for your account."
        if by_staff
        else "You asked to reset your WomSakhi password."
    )
    return EmailMessageSpec(
        to="",
        subject="Reset your WomSakhi password",
        html=_wrap(
            "Reset your password",
            f"<p>Hello {escape(name or 'there')},</p>"
            f"<p>{who} Use the button below within 24 hours to choose a new one.</p>"
            "<p>If you weren't expecting this, ignore this email — your current "
            "password keeps working and nobody can see it.</p>",
            "Choose a new password",
            url,
            preheader="Use this secure link to reset your WomSakhi password.",
            footer_note="If you did not expect this reset, ignore this email. Your current password will keep working.",
        ),
        text=f"{who} Open this link within 24 hours to set a new password: {url}",
    )


def staff_invitation_email(name: str, role: str, url: str) -> EmailMessageSpec:
    """Invitation sent when a super admin creates or reissues a staff account."""
    first = escape((name or "").strip().split(" ")[0] or "there")
    safe_role = escape(role or "staff member")
    html = _wrap(
        "You’re invited to the WomSakhi team",
        f"<p>Hi {first},</p><p>A WomSakhi administrator invited you to join as "
        f"<strong>{safe_role}</strong>.</p><p>Use the secure link below to choose your "
        "password. The invitation expires in 72 hours and can be used only once.</p>",
        "Accept invitation",
        url,
        preheader="Set your password and activate your WomSakhi staff account.",
        footer_note="If you were not expecting this invitation, contact WomSakhi support.",
    )
    text = (
        f"Hi {(name or '').strip().split(' ')[0] or 'there'},\n\n"
        f"You were invited to join the WomSakhi team as {role or 'a staff member'}.\n"
        f"Set your password within 72 hours: {url}"
    )
    return EmailMessageSpec(to="", subject="You’re invited to the WomSakhi team", html=html, text=text)


async def send(message: EmailMessageSpec, to: str) -> bool:
    """Send a templated message to an address."""
    message.to = to
    return await get_provider().send(message)
