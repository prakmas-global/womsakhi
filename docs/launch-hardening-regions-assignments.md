# Region, category and assignment hardening

## Delivered

- Added a database-backed region catalogue with create, edit, activate and archive operations.
- Existing member locations are promoted into the catalogue so older data remains manageable.
- Region rows show current member and scoped-administrator counts from live records.
- Renaming a region updates linked member locations and staff scopes, and invalidates affected staff sessions so new access rules take effect immediately.
- Archiving keeps assignments and history instead of breaking relationships.
- Added a responsive Regions administration screen with search, status filtering, loading, empty, error and confirmation states.
- Added searchable region, category and member scope selectors to staff access management.
- Added bulk member-to-region assignment from the member directory, with scope enforcement, active-region validation and one audit entry per changed member.
- Replaced free-text member location entry with a dynamic region selector while retaining legacy values for safe migration.
- Changed segment deletion to archival so rule-based category history and member counts remain available.

## Verification

- Region API live acceptance: 6/6 passed.
- Bulk member assignment live acceptance: 4/4 passed.
- Temporary regions, members and audit rows created by acceptance checks were removed.
- Backend: 289 passed, 2 intentionally skipped database-integration tests.
- Frontend TypeScript, navigation, back flow, image quality and live-data fallback checks pass.
