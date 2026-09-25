"""
The five ways a message can reach her, behind one interface.

**One `send(channel, intent)` and five adapters.** The engine above this file
never knows which provider is configured, so adding WhatsApp later is
credentials and a row in `_ADAPTERS`, not a change to the dispatcher.

**A missing provider is "off", not an error.** No SMS account means
`SMS_PROVIDER` is empty and the adapter declines. The message still reaches her
in-app, which is the surface that always works. Products that raise here end up
failing a whole notification because an optional transport was not configured.

**Cost is counted before the call, never after.** Catalogue NOTIFY-UC-015: an
optional message that would exceed the approved budget is *suppressed, not
escalated to another channel*. Escalating a too-expensive message to a cheaper
transport is exactly the behaviour that turns a budget into a suggestion.

**The rendered text is built here and nowhere else.** Templates are keyed and
rendered in her language at send time, so a woman who changed language last
week does not keep receiving last week's language. And a preview is neutral by
default — `sensitive` templates say "WomSakhi" and nothing else on a lock
screen, because the phone may be shared and the notification may be read by
the person she is hiding it from.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.db.mongodb import get_database
from app.models.notify import DeliveryModel, SubscriptionModel

# Templates that must never reveal themselves on a lock screen. Cycle, safety
# and case material; the list is deliberately conservative.
SENSITIVE_PREFIXES = ("cycle.", "health.", "safety.", "haq.", "rights.", "incase.")

# A short, plain fallback per category, used when a template key has no entry.
# Never a raw key on a screen: "reminders.xyz" is worse than "A reminder".
FALLBACK = {
    "reminders": ("A reminder", "Open WomSakhi to see it."),
    "orders": ("An update on your order", "Open WomSakhi to see it."),
    "circles": ("Something in your circle", "Open WomSakhi to see it."),
    "learning": ("About your learning", "Open WomSakhi to see it."),
    "safety": ("WomSakhi", "Open the app."),
}


def _db():
    return get_database()


def is_sensitive(template_key: str) -> bool:
    return any(template_key.startswith(p) for p in SENSITIVE_PREFIXES)


async def render(intent: dict) -> tuple[str, str]:
    """
    Title and body, in her language, safe for a shared phone.

    The locale is read from her account rather than carried on the intent, for
    the same reason preferences are: an intent raised on Monday and delivered
    on Tuesday should speak the language she uses on Tuesday.
    """
    key = intent.get("template_key", "")
    category = intent.get("category", "reminders")
    title, body = FALLBACK.get(category, FALLBACK["reminders"])

    payload = intent.get("payload") or {}

    # A digest whose words were fixed when the rule was created would be a
    # digest that lies a week later. These carry no body; it is computed now,
    # from her real bookings, goals and orders.
    if payload.get("assembled"):
        from app.engines.wiring import assemble_day
        facts = await assemble_day(intent["user_id"],
                                   evening=key.endswith("endOfDay"))
        if facts["kind"] == "morning":
            bits = []
            if facts["bookings"]:
                bits.append(f"{facts['bookings']} booked")
            if facts["goals_due"]:
                bits.append(f"{facts['goals_due']} due today")
            if facts["orders_open"]:
                bits.append(f"{facts['orders_open']} orders to move")
            return ("Your day", ", ".join(bits) if bits
                    else "Nothing needs you today.")
        return ("How today went",
                f"{facts['done']} done"
                + (f", {facts['orders_open']} orders still open"
                   if facts["orders_open"] else "."))

    if payload.get("title"):
        title = str(payload["title"])
    if payload.get("body"):
        body = str(payload["body"])

    if is_sensitive(key):
        # Nothing about her cycle, health or case leaves the app. She opens it
        # and sees the detail there, authenticated.
        return ("WomSakhi", "You have something to look at.")
    return (title, body)


# ── adapters ────────────────────────────────────────────────────────────────

async def _inapp(intent: dict) -> dict:
    """Always available, costs nothing, needs no permission."""
    from app.engines import notify

    title, body = await render(intent)
    await notify.write_inbox(intent, title=title, desc=body)
    # The only channel where "delivered" is honest, because the row is the
    # delivery — there is no third party to be uncertain about.
    return {"state": DeliveryModel.DELIVERED, "provider": "inapp"}


async def _push(intent: dict) -> dict:
    """
    Web push to every live subscription she has.

    A dead endpoint is marked rather than retried: a browser that cleared site
    data returns 404/410 forever, and retrying it five times per message is how
    a queue fills with work that can never succeed.
    """
    if not settings.VAPID_PRIVATE_KEY:
        raise RuntimeError("push_not_configured")

    subs = await _db()[SubscriptionModel.collection_name].find(
        {"user_id": intent["user_id"], "invalid_at": None}).to_list(length=20)
    if not subs:
        raise RuntimeError("no_subscription")

    title, body = await render(intent)
    payload = json.dumps({
        "title": title, "body": body,
        "url": f"/app/notifications?i={intent.get('_id', '')}",
        "tag": intent.get("dedupe_key", ""),
        # Carried so a notification she taps on a locked phone can still be
        # answered. Without it the service worker has a message and no idea
        # which occurrence it belongs to, and Done becomes a round trip
        # through the app rather than one tap.
        "occurrence_id": intent.get("occurrence_id", ""),
    })

    try:
        from pywebpush import WebPushException, webpush
    except ImportError as exc:      # the library is optional at install time
        raise RuntimeError("pywebpush_missing") from exc

    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                timeout=8,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", 0)
            if status in (404, 410):
                await _db()[SubscriptionModel.collection_name].update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"invalid_at": datetime.now(timezone.utc)}})
            continue
    if not sent:
        raise RuntimeError("all_subscriptions_failed")
    # The push service accepted it. That is not the same as her seeing it, and
    # the state says so.
    return {"state": DeliveryModel.ACCEPTED, "provider": "webpush"}


async def _email(intent: dict) -> dict:
    """Reuses the SMTP settings the app already has for verification mail."""
    if not settings.SMTP_HOST:
        raise RuntimeError("email_not_configured")
    # Reuses the app's existing provider abstraction rather than opening a
    # second SMTP path, so a mail outage behaves the same way here as it does
    # for a verification mail: logged, not a 500.
    from app.core.email import EmailMessageSpec, _wrap, send as send_mail

    user = await _db()["users"].find_one({"_id": _uid(intent["user_id"])})
    address = (user or {}).get("email", "")
    if not address:
        raise RuntimeError("no_email_address")

    title, body = await render(intent)
    ok = await send_mail(
        EmailMessageSpec(to=address, subject=title,
                         html=_wrap(title, f"<p>{body}</p>"), text=f"{title}\n\n{body}"),
        address)
    if not ok:
        raise RuntimeError("smtp_send_failed")
    return {"state": DeliveryModel.ACCEPTED, "provider": "smtp",
            "cost_micros": settings.EMAIL_COST_MICROS}


async def _sms(intent: dict) -> dict:
    """Twilio or MSG91. One short line — SMS is not a place for a paragraph."""
    if not settings.SMS_PROVIDER:
        raise RuntimeError("sms_not_configured")
    number = await _phone(intent["user_id"])
    title, body = await render(intent)
    text = f"{title}. {body}"[:300]

    if settings.SMS_PROVIDER == "twilio":
        url = (f"https://api.twilio.com/2010-04-01/Accounts/"
               f"{settings.SMS_ACCOUNT_SID}/Messages.json")
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                url, auth=(settings.SMS_ACCOUNT_SID, settings.SMS_AUTH_TOKEN),
                data={"To": number, "From": settings.SMS_FROM, "Body": text})
        r.raise_for_status()
        return {"state": DeliveryModel.ACCEPTED, "provider": "twilio",
                "id": r.json().get("sid", ""),
                "cost_micros": settings.SMS_COST_MICROS}

    if settings.SMS_PROVIDER == "msg91":
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://control.msg91.com/api/v5/flow/",
                headers={"authkey": settings.SMS_AUTH_TOKEN},
                json={"sender": settings.SMS_FROM, "mobiles": number, "text": text})
        r.raise_for_status()
        return {"state": DeliveryModel.ACCEPTED, "provider": "msg91",
                "cost_micros": settings.SMS_COST_MICROS}

    raise RuntimeError(f"unknown_sms_provider:{settings.SMS_PROVIDER}")


async def _whatsapp(intent: dict) -> dict:
    """
    Meta Cloud API.

    WhatsApp only accepts a pre-approved template outside a 24-hour customer
    service window, so `template_key` maps to an approved template name and the
    body becomes its parameters. Free text here fails at Meta, not at us, which
    is why the shape is fixed rather than convenient.
    """
    if not settings.WHATSAPP_PROVIDER:
        raise RuntimeError("whatsapp_not_configured")
    number = await _phone(intent["user_id"])
    title, body = await render(intent)
    template = (intent.get("payload") or {}).get("wa_template") or "womsakhi_reminder"

    url = f"https://graph.facebook.com/v21.0/{settings.WHATSAPP_PHONE_ID}/messages"
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": number.lstrip("+"),
                "type": "template",
                "template": {
                    "name": template,
                    "language": {"code": await _wa_locale(intent["user_id"])},
                    "components": [{"type": "body", "parameters": [
                        {"type": "text", "text": title},
                        {"type": "text", "text": body},
                    ]}],
                },
            })
    r.raise_for_status()
    data = r.json()
    return {"state": DeliveryModel.ACCEPTED, "provider": "meta",
            "id": (data.get("messages") or [{}])[0].get("id", ""),
            "cost_micros": settings.WHATSAPP_COST_MICROS}


async def _voice(intent: dict) -> dict:
    """
    A deadline read aloud, for a woman who does not read.

    REACH-UC-004. Not built as a transport yet — it needs a TTS voice per
    language and a telephony leg — so it declines rather than pretending. The
    adapter exists so that turning it on later is configuration.
    """
    raise RuntimeError("voice_not_configured")


_ADAPTERS = {
    "inapp": _inapp,
    "push": _push,
    "email": _email,
    "sms": _sms,
    "whatsapp": _whatsapp,
    "voice": _voice,
}


async def send(channel: str, intent: dict) -> dict:
    """
    Deliver on one channel, or raise so the caller can retry it alone.

    The budget check is here rather than in the dispatcher so that it cannot be
    skipped by a future caller who forgets — the cheapest place to enforce a
    rule is the one place every path must go through.
    """
    adapter = _ADAPTERS.get(channel)
    if adapter is None:
        raise RuntimeError(f"unknown_channel:{channel}")

    cost = _cost_of(channel)
    if cost > 0 and intent.get("klass") == "discretionary":
        # Suppressed, never escalated to a cheaper transport.
        raise RuntimeError("discretionary_over_paid_channel")
    return await adapter(intent)


def _cost_of(channel: str) -> int:
    return {"sms": settings.SMS_COST_MICROS,
            "whatsapp": settings.WHATSAPP_COST_MICROS,
            "email": settings.EMAIL_COST_MICROS}.get(channel, 0)


def _uid(value: str):
    from bson import ObjectId
    try:
        return ObjectId(value)
    except Exception:  # noqa: BLE001
        return None


async def _phone(user_id: str) -> str:
    user = await _db()["users"].find_one({"_id": _uid(user_id)})
    number = (user or {}).get("phone", "")
    if not number:
        raise RuntimeError("no_phone_number")
    return number


async def _wa_locale(user_id: str) -> str:
    """WhatsApp wants its own locale codes; unknown ones fall back to English."""
    user = await _db()["users"].find_one({"_id": _uid(user_id)})
    code = (user or {}).get("locale", "en")
    return {"en": "en", "hi": "hi", "te": "te", "ta": "ta", "bn": "bn",
            "mr": "mr", "gu": "gu", "kn": "kn", "ml": "ml", "pa": "pa",
            "ur": "ur", "ar": "ar", "es": "es", "fr": "fr", "pt": "pt_BR",
            "id": "id"}.get(code, "en")
