# Smart forms and visual choices

The source audit found 74 member/admin files containing editable fields. The shared form system already provides labelled controls, inline validation support, image upload, switches, and submission locking; this pass extends the behavior that every form can inherit.

## Implemented

- Design-system dropdowns automatically add search when a list has more than seven options. Search covers labels and values, has an explicit accessible label, keyboard focus, a no-match state, and works inside portalled modal menus.
- The high-effort Create Circle and Add Listing wizards now preserve unfinished values, chosen options, progress, and uploaded image URLs for seven days, scoped to the signed-in member. Successful creation clears the draft.
- Event creation uses native date/time pickers, selectable duration and language choices, and a **Duplicate as draft** action that copies an existing event without republishing it.
- Existing idempotency protection remains on circle creation; listing creation already locks while saving/uploading.
- A browser regression check reloads both member wizards and verifies their drafts return.

## Verification

- `npm run check:form-drafts`: both high-effort member drafts restore after reload.
- TypeScript and targeted ESLint: pass.
- Production build: pass.
- The feedback audit scans 979 source files and finds no browser prompt/confirm flows or timer-only success flags.
- Seven shop create/update/archive workflows pass 37/37 persistence and ownership checks.
- Circle creation passes 8/8 full-payload checks; circle/goal/wellbeing/reminder flows pass 19/19.
- Region, segment, member and content-audience selectors read live catalogues and enforce their relationships on the server.

The editable-surface inventory is closed: high-effort multi-step forms preserve drafts, short actions use locked submit controls and immediate feedback, dynamic assignment/catalogue forms use live searchable choices, and destructive operations use the shared confirmation plus archive/restore patterns.
