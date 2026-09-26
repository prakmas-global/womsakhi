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
    recipient_name: str = "",
    title_accent: str = "",
    next_step: str = "",
) -> str:
    """Render the shared, responsive WomSakhi transactional-email shell."""
    app_url = settings.APP_BASE_URL.rstrip("/")
    safe_app_url = escape(app_url, quote=True)
    reveal_url = f"{safe_app_url}/womsakhi-email-reveal.gif"
    lotus_url = f"{safe_app_url}/womsakhi-lotus-airflow.gif"
    icons_url = f"{safe_app_url}/email-icons"
    safe_title = escape(title)
    safe_preheader = escape(preheader)
    safe_footer = escape(footer_note)
    safe_cta_label = escape(cta_label)
    safe_cta_url = escape(cta_url, quote=True)
    safe_next_step = escape(next_step)

    heading = safe_title
    if title_accent:
        index = title.casefold().find(title_accent.casefold())
        if index >= 0:
            before = escape(title[:index])
            highlighted = escape(title[index:index + len(title_accent)])
            after = escape(title[index + len(title_accent):])
            heading = f'{before}<span style="color:#d52b75;">{highlighted}</span>{after}'

    first_name = (recipient_name or "").strip().split(" ")[0]
    greeting = ""
    if first_name:
        greeting = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td valign="middle" style="padding-right:10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f9e9f2;border:1px solid #ecc9da;border-radius:999px;">
                <tr>
                  <td style="padding:4px 5px 4px 7px;"><img src="{icons_url}/shield.png" width="17" height="17" alt="" style="display:block;width:17px;height:17px;border:0;"></td>
                  <td style="padding:4px 9px 4px 0;font-size:8px;line-height:12px;font-weight:800;letter-spacing:.8px;color:#8e2b69;text-transform:uppercase;white-space:nowrap;">Secure message</td>
                </tr>
              </table>
            </td>
            <td valign="middle" style="padding-right:6px;"><img src="{icons_url}/profile.png" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;"></td>
            <td valign="middle" style="font-size:14px;line-height:20px;color:#67576b;white-space:nowrap;">Hello, <strong style="color:#b01d65;font-size:15px;font-weight:700;">{escape(first_name)}</strong></td>
          </tr>
        </table>"""

    cta = (
        f"""
        <tr><td align="center" class="content-pad cta-pad" bgcolor="#ffffff" style="background:#ffffff;padding:12px 42px 6px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td bgcolor="#bd1765" style="border:1px solid #a90c58;border-radius:15px;background:#bd1765;background-image:linear-gradient(100deg,#a60058 0%,#cf176d 46%,#ef4386 100%);box-shadow:0 12px 27px rgba(201,31,111,.28);">
            <a href="{safe_cta_url}" class="action-button" style="display:inline-block;padding:14px 27px;border-radius:15px;color:#ffffff;text-decoration:none;font-size:15px;line-height:20px;font-weight:700;letter-spacing:.1px;"><img src="{icons_url}/mail-white.png" width="21" height="21" alt="" style="display:inline-block;width:21px;height:21px;border:0;vertical-align:-6px;margin-right:9px;">{safe_cta_label}&nbsp;&nbsp; →</a>
          </td></tr></table>
          <div class="cta-note" style="margin-top:9px;font-size:10px;line-height:15px;color:#8b7c8e;">Secure action for your WomSakhi account.</div>
        </td></tr>"""
        if cta_label and cta_url
        else ""
    )
    next_step_html = (
        f"""
        <tr><td align="center" class="content-pad step-pad" bgcolor="#ffffff" style="background:#ffffff;padding:7px 42px 12px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5fa;border:1px solid #e9c9da;border-radius:12px;">
            <tr>
              <td width="35" valign="middle" style="padding:9px 0 9px 12px;"><img src="{icons_url}/user-check.png" width="27" height="27" alt="" style="display:block;width:27px;height:27px;border:0;"></td>
              <td valign="middle" style="padding:9px 10px;font-size:11px;line-height:16px;color:#6a586b;text-align:left;"><strong style="color:#8f2b68;">Next step:</strong> {safe_next_step}</td>
              {f'<td valign="middle" align="right" style="padding:9px 12px 9px 0;white-space:nowrap;"><a href="{safe_cta_url}" style="color:#8c246a;text-decoration:underline;font-size:10px;line-height:15px;font-weight:700;">Backup link</a></td>' if cta_url else ''}
            </tr>
          </table>
        </td></tr>"""
        if next_step
        else ""
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{safe_title}</title>
  <style>
    @media only screen and (max-width:620px) {{.page-pad{{padding-left:0!important;padding-right:0!important}}.email-shell{{width:100%!important;border-radius:0!important}}.content-pad{{padding-left:20px!important;padding-right:20px!important}}.reveal-animation{{width:190px!important;height:190px!important}}.email-title{{font-size:30px!important;line-height:35px!important}}.lotus-animation{{width:100%!important;height:auto!important}}}}
    @media only screen and (max-width:380px) {{.page-pad{{padding-top:0!important;padding-bottom:0!important}}.content-pad{{padding-left:12px!important;padding-right:12px!important}}.header-pad{{padding-top:4px!important;padding-bottom:4px!important}}.reveal-animation{{width:108px!important;height:108px!important;border-radius:12px!important}}.main-pad{{padding-top:7px!important;padding-bottom:4px!important}}.email-title{{font-size:25px!important;line-height:28px!important;margin-top:4px!important}}.body-copy{{font-size:12px!important;line-height:16px!important;margin-top:4px!important}}.cta-pad{{padding-top:4px!important;padding-bottom:2px!important}}.action-button{{padding:9px 14px!important;font-size:13px!important;line-height:18px!important}}.cta-note{{margin-top:3px!important;font-size:8px!important;line-height:10px!important}}.step-pad{{padding-top:3px!important;padding-bottom:4px!important}}.step-pad td{{padding-top:5px!important;padding-bottom:5px!important;font-size:9px!important;line-height:12px!important}}.lotus-pad{{padding-top:1px!important;padding-bottom:1px!important}}.lotus-animation{{width:260px!important}}.footer-pad{{padding-top:5px!important;padding-bottom:5px!important}}.footer-note{{margin-bottom:3px!important;font-size:8px!important;line-height:10px!important}}.social-icon{{width:20px!important;height:20px!important}}.footer-link{{padding-left:4px!important;padding-right:4px!important}}}}
  </style>
</head><body style="margin:0;padding:0;background:#f8f0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#38283d;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{safe_preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8f0f5" style="width:100%;background:#f8f0f5;">
    <tr><td align="center" class="page-pad" style="padding:14px 10px;">
      <table role="presentation" width="570" cellpadding="0" cellspacing="0" class="email-shell" style="width:570px;max-width:570px;background:#ffffff;border:1px solid #eadde6;border-radius:22px;box-shadow:0 16px 48px rgba(76,27,72,.1);overflow:hidden;">
        <tr><td bgcolor="#571451" style="height:6px;background:#571451;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" class="content-pad header-pad" bgcolor="#fffafd" style="padding:12px 34px 10px;background:#fffafd;">
          <img src="{reveal_url}" width="218" height="218" class="reveal-animation" alt="Animated WomSakhi logo reveal" style="display:block;width:218px;height:218px;max-width:100%;margin:0 auto;border:1px solid #56304f;border-radius:18px;box-shadow:0 16px 34px rgba(106,25,91,.2);">
        </td></tr>
        <tr><td align="center" class="content-pad main-pad" bgcolor="#ffffff" style="background:#ffffff;padding:15px 42px 8px;border-left:1px solid #eadde6;border-right:1px solid #eadde6;">
          {greeting}
          <h1 class="email-title" style="margin:{'9px' if greeting else '0'} 0 0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:43px;font-weight:700;letter-spacing:-.75px;color:#40113f;">{heading}</h1>
          <div class="body-copy" style="margin:9px auto 0;max-width:445px;font-size:14px;line-height:21px;color:#6f6273;">{body_html}</div>
        </td></tr>
        {cta}
        {next_step_html}
        <tr><td align="center" class="content-pad lotus-pad" bgcolor="#fffafd" style="padding:5px 34px 6px;background:#fffafd;border-left:1px solid #eadde6;border-right:1px solid #eadde6;border-top:1px solid #f5e8ef;">
          <img src="{lotus_url}" width="455" height="92" class="lotus-animation" alt="Animated WomSakhi lotus" style="display:block;width:455px;max-width:100%;height:auto;margin:0 auto;border:0;">
        </td></tr>
        <tr><td align="center" class="content-pad footer-pad" bgcolor="#fff8fc" style="padding:10px 34px 12px;background:#fff8fc;border:1px solid #efdee8;border-top:0;border-radius:0 0 22px 22px;">
          <div class="footer-note" style="font-size:9px;line-height:13px;color:#8f8291;margin-bottom:7px;">{safe_footer}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
            <td style="padding:0 4px;"><img src="{icons_url}/instagram.png" width="26" height="26" class="social-icon" alt="Instagram" style="display:block;width:26px;height:26px;border:0;"></td>
            <td style="padding:0 4px;"><img src="{icons_url}/facebook.png" width="26" height="26" class="social-icon" alt="Facebook" style="display:block;width:26px;height:26px;border:0;"></td>
            <td style="padding:0 4px;"><img src="{icons_url}/linkedin.png" width="26" height="26" class="social-icon" alt="LinkedIn" style="display:block;width:26px;height:26px;border:0;"></td>
            <td style="padding:0 4px;"><img src="{icons_url}/youtube.png" width="26" height="26" class="social-icon" alt="YouTube" style="display:block;width:26px;height:26px;border:0;"></td>
          </tr></table>
          <p style="margin:7px 0 0;font-size:10px;line-height:15px;"><a href="{safe_app_url}" class="footer-link" style="padding:3px 7px;color:#842866;text-decoration:underline;font-weight:700;">WomSakhi</a><a href="{safe_app_url}/contact" class="footer-link" style="padding:3px 7px;color:#842866;text-decoration:underline;font-weight:600;">Support</a><a href="{safe_app_url}/privacy" class="footer-link" style="padding:3px 7px;color:#842866;text-decoration:underline;font-weight:600;">Privacy</a></p>
          <p style="margin:3px 0 0;font-size:9px;line-height:13px;color:#aa9bab;">WomSakhi · India</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def verification_email(name: str, url: str) -> EmailMessageSpec:
    first = (name or "").strip().split(" ")[0] or "there"
    html = _wrap(
        "Verify your email",
        "We received a request to create your WomSakhi account. Verify your email "
        "address to continue your journey with us.",
        "Verify Email Address",
        url,
        preheader="Confirm your email to continue your WomSakhi application.",
        footer_note="If you did not create this application, you can safely ignore this email.",
        recipient_name=name,
        title_accent="email",
        next_step="Complete your profile, then our authorised team will review your account.",
    )
    text = f"Hi {first},\n\nConfirm your WomSakhi email address:\n{url}\n\nThis link expires in {settings.EMAIL_TOKEN_HOURS} hours."
    return EmailMessageSpec(to="", subject="Confirm your WomSakhi email", html=html, text=text)


def submitted_email(name: str) -> EmailMessageSpec:
    first = (name or "").strip().split(" ")[0] or "there"
    html = _wrap(
        "We've received your documents",
        "Thank you. Our team is reviewing your application now. Because WomSakhi is "
        "a women-only community, every account is checked by a real person. This "
        "usually takes 1–2 working days.",
        "View application status",
        f"{settings.APP_BASE_URL.rstrip('/')}/app/verify",
        preheader="Your documents reached the WomSakhi review team.",
        footer_note="This is a status update for your WomSakhi application.",
        recipient_name=name,
        title_accent="documents",
        next_step="We will email you as soon as the review is complete.",
    )
    text = f"Hi {first},\n\nWe've received your documents. Our team reviews every account by hand; this usually takes 1-2 working days."
    return EmailMessageSpec(to="", subject="WomSakhi — your application is being reviewed", html=html, text=text)


def approved_email(name: str, url: str) -> EmailMessageSpec:
    first = (name or "").strip().split(" ")[0] or "there"
    html = _wrap(
        "Your account is approved",
        "Your WomSakhi membership is ready. You can now book sessions, join programs "
        "and message our team.",
        "Open WomSakhi",
        url,
        preheader="Your WomSakhi membership is approved and ready.",
        footer_note="This approval was completed by an authorised WomSakhi administrator.",
        recipient_name=name,
        title_accent="approved",
        next_step="Sign in and complete any remaining profile details.",
    )
    text = f"Hi {first},\n\nYour WomSakhi account has been approved. Sign in: {url}"
    return EmailMessageSpec(to="", subject="Your WomSakhi account is approved", html=html, text=text)


def rejected_email(name: str, reason: str) -> EmailMessageSpec:
    first = (name or "").strip().split(" ")[0] or "there"
    detail = f"<br><strong style='color:#8f2b68;'>Reason:</strong> {escape(reason)}" if reason else ""
    html = _wrap(
        "We couldn't verify your account",
        "We weren't able to verify your account with the documents provided."
        f"{detail}",
        "Contact support",
        f"{settings.APP_BASE_URL.rstrip('/')}/contact",
        preheader="An update about your WomSakhi application.",
        footer_note="This is a status update for your WomSakhi application.",
        recipient_name=name,
        title_accent="account",
        next_step="Contact support and our team will help you resolve the issue.",
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
            f"{escape(who)} Use the secure button below within 24 hours to choose a new password.",
            "Choose a new password",
            url,
            preheader="Use this secure link to reset your WomSakhi password.",
            footer_note="If you did not expect this reset, ignore this email. Your current password will keep working.",
            recipient_name=name,
            title_accent="password",
            next_step="After changing it, sign in again with your new password.",
        ),
        text=f"{who} Open this link within 24 hours to set a new password: {url}",
    )


def staff_invitation_email(name: str, role: str, url: str) -> EmailMessageSpec:
    """Invitation sent when a super admin creates or reissues a staff account."""
    first = escape((name or "").strip().split(" ")[0] or "there")
    safe_role = escape(role or "staff member")
    html = _wrap(
        "You’re invited to the WomSakhi team",
        f"A WomSakhi administrator invited you to join as <strong>{safe_role}</strong>. "
        "Use the secure link below to choose your password.",
        "Accept invitation",
        url,
        preheader="Set your password and activate your WomSakhi staff account.",
        footer_note="If you were not expecting this invitation, contact WomSakhi support.",
        recipient_name=name,
        title_accent="team",
        next_step="This invitation expires in 72 hours and can be used only once.",
    )
    text = (
        f"Hi {(name or '').strip().split(' ')[0] or 'there'},\n\n"
        f"You were invited to join the WomSakhi team as {role or 'a staff member'}.\n"
        f"Set your password within 72 hours: {url}"
    )
    return EmailMessageSpec(to="", subject="You’re invited to the WomSakhi team", html=html, text=text)


def member_login_alert_email(
    admin_name: str,
    member_name: str,
    member_email: str,
    verification_status: str,
    occurred_at: str,
    member_id: str,
) -> EmailMessageSpec:
    """Security notice for super admins after a member signs in."""
    safe_member = escape(member_name or "Member")
    safe_email = escape(member_email)
    safe_status = escape((verification_status or "unknown").replace("_", " ").title())
    safe_time = escape(occurred_at)
    base = settings.APP_BASE_URL.rstrip("/")
    review_url = f"{base}/dashboard/users/verification?account={escape(member_id, quote=True)}"
    assign_url = f"{base}/dashboard/users/verification?account={escape(member_id, quote=True)}&assign={escape(member_id, quote=True)}"
    manage_url = f"{base}/dashboard/users?account={escape(member_id, quote=True)}"
    body = (
        f"<strong style='color:#4b1645;'>{safe_member}</strong> "
        f"(<a href='mailto:{safe_email}' style='color:#9a286d;'>{safe_email}</a>) signed in at "
        f"<strong>{safe_time}</strong>."
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
        "style='margin-top:10px;background:#fff5fa;border:1px solid #ebcede;border-radius:10px;'>"
        "<tr><td style='padding:9px 12px;font-size:11px;line-height:16px;color:#655568;'>"
        f"Current account state: <strong style='color:#a51e67;'>{safe_status}</strong><br>"
        f"<a href='{assign_url}' style='color:#8c246a;font-weight:700;'>Assign to an admin</a>"
        "&nbsp;&nbsp;·&nbsp;&nbsp;"
        f"<a href='{manage_url}' style='color:#8c246a;font-weight:700;'>Manage activation or deactivation</a>"
        "</td></tr></table>"
    )
    html = _wrap(
        "Member sign-in alert",
        body,
        "Review documents",
        review_url,
        preheader=f"{member_name or 'A member'} signed in to WomSakhi.",
        footer_note="This security notice was sent to an authorised WomSakhi super administrator.",
        recipient_name=admin_name,
        title_accent="sign-in",
        next_step="Review the documents yourself or assign this verification task to another eligible admin.",
    )
    text = (
        f"{member_name or 'Member'} ({member_email}) signed in at {occurred_at}. "
        f"Account state: {verification_status or 'unknown'}. Review: {review_url}. "
        f"Assign: {assign_url}. Manage: {manage_url}"
    )
    return EmailMessageSpec(to="", subject=f"WomSakhi sign-in: {member_name or member_email}", html=html, text=text)


def verification_review_alert_email(
    admin_name: str,
    member_name: str,
    member_email: str,
    verification_status: str,
    member_id: str,
    reminder_number: int,
) -> EmailMessageSpec:
    """Numbered request/follow-up for an application awaiting human review."""
    base = settings.APP_BASE_URL.rstrip("/")
    safe_id = escape(member_id, quote=True)
    review_url = f"{base}/dashboard/users/verification?account={safe_id}"
    assign_url = f"{review_url}&assign={safe_id}"
    safe_member = escape(member_name or "Member")
    safe_email = escape(member_email)
    safe_status = escape((verification_status or "in_review").replace("_", " ").title())
    number = max(1, int(reminder_number))
    body = (
        f"<strong style='color:#4b1645;'>{safe_member}</strong> "
        f"(<a href='mailto:{safe_email}' style='color:#9a286d;'>{safe_email}</a>) "
        "has asked the team to complete her account review."
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
        "style='margin-top:10px;background:#fff5fa;border:1px solid #ebcede;border-radius:10px;'>"
        "<tr><td style='padding:9px 12px;font-size:11px;line-height:16px;color:#655568;'>"
        f"Follow-up number: <strong style='color:#a51e67;'>#{number}</strong><br>"
        f"Current state: <strong>{safe_status}</strong><br>"
        f"<a href='{assign_url}' style='color:#8c246a;font-weight:700;'>Assign this review to an admin</a>"
        "</td></tr></table>"
    )
    html = _wrap(
        f"Verification follow-up #{number}",
        body,
        "Review application",
        review_url,
        preheader=f"Follow-up #{number} for {member_name or 'a member'} awaiting verification.",
        footer_note="This review reminder stops automatically when the application leaves the review queue.",
        recipient_name=admin_name,
        title_accent=f"#{number}",
        next_step="Review the identity documents or assign the task to another eligible admin.",
    )
    text = (
        f"Verification follow-up #{number}: {member_name or 'Member'} ({member_email}), "
        f"state {verification_status}. Review: {review_url}. Assign: {assign_url}"
    )
    return EmailMessageSpec(
        to="",
        subject=f"Verification follow-up #{number}: {member_name or member_email}",
        html=html,
        text=text,
    )


async def send(message: EmailMessageSpec, to: str) -> bool:
    """Send a templated message to an address."""
    message.to = to
    return await get_provider().send(message)
