# Launch hardening: Super Admin hierarchy and staff scopes

Verified 26 September 2026.

- WomSakhi now ensures Regional Admin, Category Admin, and Member Manager roles in existing and fresh installations.
- Super Admin can assign platform-wide access or a live selection of regions, member categories, and individual members.
- Scope choices are loaded from backend data and can be searched without typing identifiers.
- Assignments are stored on the staff login, included in the staff directory, and recorded in the append-only activity log.
- Changing scope increments the account's token version, ending old sessions so narrower access takes effect immediately.
- The backend applies scope to member lists, statistics, growth, exports, profiles, edits, bulk status changes, approvals, suspensions, deletion workflows, and password reset actions.
- Out-of-scope record requests return 404 so they do not reveal that another member exists.
- Super Admin remains platform-wide and cannot accidentally scope herself out of recovery access.

## Verification

- 7/7 live checks passed: hierarchy role, dynamic options, assignment persistence, scoped sign-in, scoped list, out-of-scope detail denial, and immediate suspension.
- 4 focused scope policy tests pass within the 284-test backend suite.
- TypeScript and the 206-route production build pass.
- The temporary staff login and directory record created by the live test were removed.
