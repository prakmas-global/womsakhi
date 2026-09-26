# Shop, circle, and listing launch hardening

## Functional shop workflows

The seven routes that previously rendered `data-not-ready` now use an authenticated, member-owned `shop_operations` contract:

- pre-orders and material funding
- recurring customer subscriptions
- service availability and appointments
- wholesale enquiries and quotes
- live-sale planning
- voice/dictation listing drafts
- private dispute records

Each supports create, list, status update, and soft archive. Backend queries always include the signed-in `user_id`; create, update, and archive actions are audited. The database has compound indexes for member/kind/update order and member/archive/status.

Verification: `npm run check:shop-operations` passes 37/37 checks across anonymous denial and all seven workflows.

## Complete circle creation

Circle creation now persists the fields shown by the four-step wizard: privacy, cover, icon, tags, guidelines, posting policy, review-first preference, notification preference, and pending invitations. The previous “not saved yet” messages were removed. Invitations are normalized, deduplicated, and stored separately with a unique circle/target index.

Verification: `npm run check:circle-create` passes 8/8 live database checks; the temporary verification circle and related rows were removed after the test.

Circle detail pages also load real shared resource links. Joined members can add validated HTTP(S) links, authors can soft-remove their own links, and private-circle membership rules apply to reads. The four invented downloadable files and their nonfunctional buttons were removed.

## Complete listing payload

The listing wizard now persists the upper end of a price range, compare-at price, minimum quantity, low-stock threshold, continue-when-out setting, delivery and processing choices, highlights, tags, and quote configuration. These fields round-trip through seller, market, and public listing response shapes.

The seller-side quote drawer is explicitly a preview. Real buyer quote questions use the existing authenticated market endpoint and arrive in the seller's message thread. The legacy confirmation route no longer claims a browser-only draft was delivered.

## Mentor requests

A member can now withdraw her own pending mentorship request directly. The endpoint is ownership-scoped, idempotently returns an already-withdrawn request, and refuses withdrawal after staff has accepted or completed it.
