# WomSakhi Cycle — research and implementation map

**Reviewed:** 26 September 2026
**Scope:** desktop cycle experience, member API, private storage and reports

## Public products reviewed

- [Sakhi Health](https://sakhi.health/): cycle tracking, daily insights, nutrition, fertility, pregnancy, menopause, specialist support and an AI health companion.
- [PeriodSakhi](https://www.periodsakhi.com/) and its [Google Play listing](https://play.google.com/store/apps/details?id=com.periodsakhi.rha): period, fertile-window and ovulation estimates; flow, mood and symptom logs; calendar, patterns, reminders, guidance and sharing with trusted people.

This work uses the products' publicly described capability set as research. It does not copy their source code, private screens, proprietary prediction logic, wording or assets.

## Feature coverage

| Capability | WomSakhi implementation |
| --- | --- |
| Period calendar and history | Existing month/week calendar, editable history and calculated cycle history |
| Period, ovulation and fertile-window estimates | Existing cycle engine with separate user controls for period, fertility and phase estimates |
| Prediction quality | Confidence and recent cycle variation shown in the report |
| Daily tracking | New advanced daily log for flow, pain, symptom severity, mood, energy, sleep, water, movement and private notes |
| Fertility observations | Optional basal temperature, cervical fluid and ovulation-test results |
| Private reproductive-health details | Pregnancy-test and sexual-activity fields remain hidden until the member opens them |
| Medicines and supplements | New private medicine list, dose/time/instructions, pause/resume and daily taken state |
| Patterns and analytics | Symptom frequency, mood history, wellbeing averages, flow counts, BBT history and measured-cycle confidence |
| Cycle phases and self-care | Existing menstrual, follicular, ovulation and luteal phase guidance, nutrition and wellbeing content |
| Personal goals | New understand-cycle, trying-to-conceive, symptom-care and perimenopause modes |
| Health context | Optional PCOS/PCOD, endometriosis, fibroids, thyroid, PMDD and anaemia selection; explicitly described as diagnosed context, not an app diagnosis |
| Reminders | Existing daily check-in, upcoming-period, ovulation, medicine and long-period reminders |
| Clinician/trusted-person summary | New member-controlled printable/PDF report with granular opt-in care-summary fields |
| Help and guidance | Existing WomSakhi mentor, learning, nutrition, wellbeing and Sakhi assistant routes remain linked from the health experience |
| Privacy controls | Member-only API, no staff/admin health-data route, optional fields, adult gate, export, full erasure and discreet mode |

## New desktop routes

- `/app/health/cycle/daily`
- `/app/health/cycle/medicines`
- `/app/health/cycle/settings`
- `/app/health/cycle/report`

The cycle overview, insights and reminders now share the same desktop section navigation.

## API additions

- `GET /me/cycle/days/{date}` reads one editable day.
- `PUT /me/cycle/days/{date}` accepts the expanded optional health observations.
- `PUT /me/cycle/settings` stores goal, diagnosed context, prediction controls and report-sharing preferences.
- `POST /me/cycle/medicines` adds a medicine or supplement.
- `PATCH /me/cycle/medicines/{id}` edits, pauses or resumes it.
- `GET /me/cycle` includes medicines, prediction confidence, cycle variation and 90-day health metrics.

## Deliberate product boundaries

- Calendar estimates are labelled as estimates and never presented as contraception, proof of ovulation, a pregnancy result or a diagnosis.
- The app stores self-entered observations. It does not prescribe medicine or change doses.
- Nothing is sent to a clinician, partner or caregiver automatically. The member explicitly prints or saves her selected report.
- Pregnancy week tracking, kick counting, lab-report interpretation and verified medical consultations are separate clinical products. They have not been represented as completed cycle-tracker features.
- Exact parity with private, authenticated competitor screens or undisclosed algorithms cannot be verified from public material. WomSakhi implements the publicly documented cycle capability set through its own models, API and interface.

## Verification

- Live API flow: setup, expanded daily log, settings, medicine add/pause, analytics, export and erasure.
- Desktop browser review at 1600 × 1000 for overview, daily log, medicines, settings and report.
- Browser checks: no horizontal overflow, unlabelled controls, unnamed buttons, reported contrast failures or console errors.
- Backend schema/model regression tests cover valid advanced observations, unsafe numeric bounds, private defaults, settings and medicine validation.
