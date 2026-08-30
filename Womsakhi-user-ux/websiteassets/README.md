# Website Asset Library — 54 assets

Every element from the source sheet, cut out individually with its own transparency
(no cropping into neighbours, no leftover background).

## What's inside

```
png/           transparent PNG  — use these by default
webp/          lossless WebP    — same images, smaller files, for production
index.html     open in a browser to preview everything
manifest.json  machine-readable list (name, size, category, source coords)
```

Both folders share the same sub-folders and file names, so you can swap
`png/…/name.png` for `webp/…/name.webp` with a find-and-replace.

## Categories

| Folder | Count | What it is |
|---|---|---|
| `illustrations/` | 29 | Full character scenes — hero images, feature sections, empty states |
| `avatars/` | 6 | Head-and-shoulders portraits — testimonials, team, profile placeholders |
| `mascot/` | 4 | The robot mascot in 4 poses — chat widget, onboarding, 404 |
| `icons/` | 8 | Single 3D objects — feature bullets, cards |
| `objects/` | 4 | Desk flat-lays — blog headers, section dividers |
| `banners/` | 3 | Wide strips — section backgrounds, CTA bands |

## Usage

```html
<img src="/assets/png/illustrations/hero-woman-working-laptop.png"
     alt="Woman working on a laptop" width="176" height="158">
```

With a WebP fallback:

```html
<picture>
  <source srcset="/assets/webp/illustrations/hero-woman-working-laptop.webp" type="image/webp">
  <img src="/assets/png/illustrations/hero-woman-working-laptop.png" alt="…">
</picture>
```

## A note on resolution

The source sheet is 1536×1024, so each cut-out is at its true native size —
roughly 75–220 px wide for characters and icons, up to 453 px for banners.
That is all the detail the source actually contains. They are sharp at these
sizes; for a full-width hero you'd want the original art re-rendered larger
rather than upscaled from here.

## Full list


### Illustrations / Scenes

- `hero-woman-working-laptop` — 176×158
- `woman-reading-book` — 144×157
- `woman-training-workshop` — 184×161
- `woman-counting-savings` — 162×158
- `woman-meditating` — 153×158
- `woman-product-photography` — 173×164
- `woman-recording-podcast` — 166×158
- `woman-writing-notes` — 149×158
- `woman-tablet-growth-chart` — 145×140
- `two-women-learning-laptop` — 198×135
- `woman-sewing-machine` — 152×135
- `woman-graduate-certificate` — 130×145
- `woman-back-view` — 64×137
- `woman-video-call-mentoring` — 211×133
- `woman-market-stall` — 159×140
- `two-women-back-view` — 87×141
- `woman-mentoring-teen` — 123×119
- `woman-packing-tiffin` — 138×134
- `woman-vendor-handing-parcel` — 185×136
- `woman-using-smartphone` — 113×130
- `woman-shop-owner` — 170×136
- `women-loan-meeting` — 219×134
- `woman-packing-orders` — 154×130
- `women-group-circle` — 191×127
- `two-women-support` — 181×129
- `woman-planning-board` — 168×139
- `mother-baby-laptop` — 204×143
- `woman-planting-sapling` — 173×141
- `woman-with-trolley-bag` — 133×143

### Avatars

- `avatar-woman-purple-kurta` — 166×215
- `avatar-woman-teal-shirt` — 112×218
- `avatar-woman-elder-saree` — 108×217
- `avatar-woman-hijab` — 117×218
- `avatar-woman-blazer` — 119×214
- `avatar-woman-pink-glasses` — 128×217

### Mascot (robot)

- `mascot-robot-waving` — 114×140
- `mascot-robot-standing` — 83×141
- `mascot-robot-cheering` — 143×140
- `mascot-robot-reading` — 96×138

### Icons

- `icon-shopping-basket` — 124×124
- `icon-wallet` — 97×86
- `icon-calendar-notepad` — 76×105
- `icon-padlock` — 73×102
- `icon-paper-plane` — 89×79
- `icon-signpost` — 102×123
- `icon-gift-box` — 108×111
- `icon-potted-plant` — 92×109

### Objects & flat-lays

- `flatlay-laptop-mug` — 155×86
- `flatlay-notebook-pen` — 142×117
- `flatlay-notebook-magnifier` — 124×114
- `flatlay-mug-books` — 124×88

### Banners

- `banner-team-collaboration` — 453×122
- `banner-market-sunset` — 390×123
- `banner-abstract-purple` — 352×122
