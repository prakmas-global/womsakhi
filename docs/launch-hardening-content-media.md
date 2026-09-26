# Content, media and asset hardening

## Delivered

- Content create, edit, schedule, publish, unpublish, trash, restore and permanent-delete actions use the live API and database.
- Bulk content actions, author filters, real storage totals, member-style detail previews and audit activity are available from the dashboard.
- The media library now searches file names, filters by asset type, previews files, reuses images as a new content cover and removes unused files.
- Media deletion checks every current image-bearing record type before removing bytes. It returns a conflict when content, a profile, circle, post, story, event, opportunity or shop listing still references the asset.
- Media removal writes an audit record.
- Browser uploads resize oversized images for their purpose and convert them to quality-controlled WebP when that produces a smaller file. Avatars cap at 640 px, covers at 1600 px and other images at 2000 px. Animated GIF files remain unchanged.
- Generated admin artwork is stored as an optimized local WebP and the asset quality check verifies the natural pixel size of all referenced app artwork.
- Content audience controls read the active region and segment catalogues. The API rejects unknown or inactive targets, stores the selection with the item, and the authenticated member feed returns only published content matching that member's profile.

## Verification

- Referenced media deletion acceptance: 2/2 passed.
- Audience delivery acceptance: 6/6 passed, including region inclusion, cross-region exclusion and invalid-target rejection; temporary content was removed.
- Frontend TypeScript, image quality and navigation checks pass.
- Backend: 293 passed, 2 intentional database-integration skips.
