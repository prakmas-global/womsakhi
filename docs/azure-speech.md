# Azure Speech — WomSakhi

Everything about the speech service that powers **Sakhi's voice and lip-sync**.

> **Secrets are NOT in this file — on purpose.** Documentation gets shared,
> screenshotted, pasted into chats and committed to git. Keys live in
> `womencrafts-backend/backend/.env`, which is git-ignored. This file tells you
> *where everything is* so anyone on the team can find it without ever handling
> the secret itself.

---

## The resource

| | |
|---|---|
| **Portal account** | praveen.prakmas@gmail.com |
| **Subscription** | Azure subscription 1 (free trial, $200 credit) |
| **Resource group** | `womsakhi` |
| **Resource name** | `womsakhi-speech` |
| **Region** | Central India (`centralindia`) |
| **Pricing tier** | Free **F0** |
| **Created** | 14 Aug 2026 |

**Direct link:** portal.azure.com → search `womsakhi-speech`

**Why Central India:** it's the closest datacentre to our members, so speech
comes back with the least delay. Latency is what makes a voice assistant feel
alive or broken.

---

## Where the keys live

```
womencrafts-backend/backend/.env
```

```
AZURE_SPEECH_KEY=<KEY 1 from the portal>
AZURE_SPEECH_REGION=centralindia
```

To find them again: **portal.azure.com → womsakhi-speech → Keys and Endpoint**.

Azure gives you **two** keys on purpose. That's so you can rotate without
downtime: switch the app to KEY 2, regenerate KEY 1, then switch back. Never
regenerate the key currently in use.

**Endpoint pattern** (the SDK builds this from the region, no need to store it):
```
https://centralindia.api.cognitive.microsoft.com/
wss://centralindia.tts.speech.microsoft.com/   ← streaming voice
```

---

## What we use it for

**1. Text-to-speech — Sakhi's voice**
Neural voices, one per language the member has chosen.

**2. Visemes — the reason lip-sync looks real**
Azure's neural TTS emits `viseme` events: a mouth-shape ID plus its offset in
milliseconds, for every sound. That drives the avatar's mouth into actual
shapes. The common alternative — animating the jaw from audio volume — always
looks like a puppet, because loudness is not the same thing as a vowel.

This is the single reason we chose Azure over a warmer-sounding provider.

**3. Speech-to-text — she can talk instead of type**
Matters more than it sounds: some members read little, and many find speaking
faster than typing on a phone in their own script.

---

## Voices for our languages

| Language | Locale | Female neural voice |
|---|---|---|
| Hindi | `hi-IN` | `hi-IN-SwaraNeural` |
| Urdu | `ur-IN` | `ur-IN-GulNeural` |
| Tamil | `ta-IN` | `ta-IN-PallaviNeural` |
| Bengali | `bn-IN` | `bn-IN-TanishaaNeural` |
| Telugu | `te-IN` | `te-IN-ShrutiNeural` |
| Marathi | `mr-IN` | `mr-IN-AarohiNeural` |
| Gujarati | `gu-IN` | `gu-IN-DhwaniNeural` |
| Kannada | `kn-IN` | `kn-IN-SapnaNeural` |
| Malayalam | `ml-IN` | `ml-IN-SobhanaNeural` |
| Punjabi | `pa-IN` | `pa-IN-VaaniNeural` |
| English (India) | `en-IN` | `en-IN-NeerjaNeural` |

Confirm the exact list in the portal's **Voice Gallery** before wiring each one —
Microsoft adds and renames voices over time.

---

## Cost

**Free F0 tier** covers roughly:
- ~0.5M characters/month of neural text-to-speech
- ~5 audio hours/month of speech-to-text

That is far more than development needs. When real members arrive, watch usage
in **Cost Management → Cost analysis** and move to **S0** (~$16 per 1M
characters) before hitting the ceiling — F0 throttles rather than bills you.

**Set a budget alert:** Cost Management → Budgets → ₹500/month, alert at 80%.

---

## Safety notes

- **Voice recordings are personal data.** We transcribe and discard; we do not
  keep audio unless there's a stated reason and a retention period.
- **The key is server-side only.** The browser never sees it — the backend mints
  short-lived tokens for the client instead. A key shipped to the browser is a
  key published to the world.
- **If a key leaks:** regenerate it in the portal immediately (Keys and
  Endpoint → Regenerate Key 1). Old key dies instantly.

---

## Related

- `docs/anthropic.md` — the language model (to be written when that key exists)
- `womencrafts-backend/backend/app/core/payments/` — the same
  provider-adapter pattern this will follow
