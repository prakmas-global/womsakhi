# Launch hardening: circles, goals, and wellbeing

Verified 26 September 2026.

## Circle operations completed

- Hosts can edit the circle name, topic, description, guidelines, tags, posting policy, review preference, and notification preference.
- Every circle exposes its actual member roster without leaking savings payment state to ordinary circles.
- Per-member mute state persists in `circle_preferences` and is restored on another session.
- Post and circle reports enter the existing private safety-report queue, with the source record identified in `about`.
- A member can delete her own post; other members receive a real Report action.
- Circle resources are live, member-owned links with create, list, retry, empty, and remove states.
- Circle posts accept uploaded images through the authenticated media service.
- Host-only posting is enforced by the backend; circle hosts and assigned moderators can post, ordinary members cannot.
- Placeholder poll controls were removed. Event and file actions now open their working tabs.

## Goal operations completed

- Existing goals can be edited without changing their measurement type.
- Labels, targets, target wording, units, and optional notes persist through `/me/goals/{id}/details`.
- Money targets remain entered in rupees and stored in paise.
- Goal notes are shown on the goal card after reload.

## Mood activity engagement completed

- Reviewed mood activities avoid the ten most recently shown activities when another option exists.
- Members can start, complete, skip, save, unsave, and reopen saved activities.
- Engagement persists in `wellbeing_activity_engagements` with a unique member/activity constraint.
- Mood support words shown in Cycle views now come from reviewed backend support cards rather than the local quote list.
- Administrators continue to create, edit, review, unreview, and remove those wellbeing cards and activities from the Resources dashboard.

## Verification

- `check:launch-gaps`: 19/19 live API and database checks passed, including reminder create/list/preview/edit/stop.
- Backend suite: 284 passed, 2 intentionally skipped live-Mongo policy tests.
- TypeScript: passed with `npx tsc --noEmit`.
- Temporary circles and safety reports created by the live check were removed after verification.
