# Website Asset Library — 37 assets

Every element from the sheet, cut out individually with its own transparency,
then upscaled 4× and edge-cleaned for web use.

## What's inside

```
png/            4× high-resolution transparent PNG  ← use these
webp/           same images as WebP (quality 92, ~5x smaller — ship these)
original-1x/    native-resolution cut-outs, untouched source pixels
index.html      open in a browser to preview everything
manifest.json   name, category, final size, native size, source coords
```

`png/`, `webp/` and `original-1x/` share identical sub-folders and file names,
so switching between them is a find-and-replace.

## Categories

| Folder | Count | Use it for |
|---|---|---|
| `illustrations/` | 19 | Hero images, feature sections, empty states |
| `avatars/` | 6 | Testimonials, team grids, profile placeholders |
| `mascot/` | 3 | Chat widget, onboarding, 404 / empty screens |
| `icons/` | 6 | Feature bullets, cards, section markers |
| `banners/` | 3 | Full-width section backgrounds, CTA bands |

## Sizes

Illustrations land around **550–970 px** wide, avatars **900–990 × ~1030 px**,
icons **376–560 px**, banners **~1950–2010 × ~610 px**. That covers retina
display at typical web dimensions.

## Usage

```html
<img src="/assets/png/illustrations/woman-shop-owner.png"
     alt="Shop owner standing in front of her stall" width="382" height="370">
```

Serve WebP first, PNG as fallback:

```html
<picture>
  <source srcset="/assets/webp/illustrations/woman-shop-owner.webp" type="image/webp">
  <img src="/assets/png/illustrations/woman-shop-owner.png" alt="…" loading="lazy">
</picture>
```

Set `width`/`height` (or `aspect-ratio`) on every `<img>` so the page doesn't
shift while images load — the exact numbers are in `manifest.json`.

## How the upscaling was done — and its limits

The source sheet is 1536×1024, so each cut-out started small. To get usable
resolution the assets were enlarged in two 2× passes with Lanczos resampling,
plus edge-aware smoothing and unsharp masking, and the alpha edge was
re-tightened so cut-outs stay crisp rather than fuzzy.

This is high-quality **interpolation and enhancement** — it makes the assets
sharp and clean at large sizes, but it cannot invent detail that was never in
the source. Fine texture (individual hair strands, tiny background props) is
smoother than a natively-rendered large image would be. For anything that
fills most of the screen, re-rendering that specific illustration at a large
size will always beat upscaling. `original-1x/` holds the untouched cut-outs
if you'd rather do your own processing.

## Full list

### Illustrations / Scenes

- `woman-vendor-handing-parcel` — 820×696 (native 205×174)
- `woman-order-notification` — 688×694 (native 173×174)
- `woman-shop-owner` — 760×735 (native 191×185)
- `women-business-handshake` — 736×676 (native 185×169)
- `woman-packing-orders` — 757×724 (native 190×181)
- `woman-chalkboard-teaching` — 544×636 (native 136×160)
- `women-group-circle` — 968×577 (native 242×145)
- `two-women-support` — 644×620 (native 161×156)
- `women-celebrating` — 796×720 (native 201×180)
- `elder-woman-mentoring` — 784×629 (native 196×158)
- `woman-teaching-children` — 775×728 (native 194×182)
- `woman-walking-with-bag` — 584×781 (native 147×196)
- `woman-meditating` — 682×652 (native 171×163)
- `woman-writing-notes` — 560×690 (native 140×174)
- `woman-reading-document` — 609×652 (native 153×163)
- `woman-planning-board` — 595×677 (native 149×170)
- `woman-with-trolley-bag` — 537×736 (native 135×184)
- `mother-baby-laptop` — 629×669 (native 158×168)
- `woman-planting-sapling` — 662×693 (native 167×175)

### Avatars

- `avatar-woman-teal-shirt` — 916×1017 (native 229×255)
- `avatar-woman-elder-saree` — 977×1025 (native 245×257)
- `avatar-woman-hijab` — 928×1012 (native 232×253)
- `avatar-woman-blazer` — 958×1032 (native 240×259)
- `avatar-woman-blue-saree` — 896×1036 (native 224×259)
- `avatar-woman-pink-glasses` — 984×1032 (native 246×259)

### Mascot (robot)

- `mascot-robot-waving` — 528×640 (native 132×161)
- `mascot-robot-cheering` — 609×652 (native 153×163)
- `mascot-robot-reading` — 416×624 (native 104×156)

### Icons

- `icon-shopping-basket` — 554×496 (native 140×124)
- `icon-wallet` — 454×414 (native 114×104)
- `icon-calendar` — 480×464 (native 120×116)
- `icon-padlock` — 478×443 (native 120×112)
- `icon-paper-plane` — 376×328 (native 94×83)
- `icon-signpost` — 376×558 (native 94×140)

### Banners

- `banner-team-collaboration` — 2006×610 (native 502×154)
- `banner-market-sunset` — 1945×602 (native 487×152)
- `banner-abstract-gradient` — 2004×601 (native 501×152)
