/**
 * The picture that explains a thing at a glance.
 *
 * Every listing in the app — a job, a course, a mentor, an event, a circle, a
 * scheme, a product — gets a big thumbnail. A real photo always wins (a
 * product's own photo, a mentor's picture, an event's cover). When there is
 * none, `artFor` reads what the item is ABOUT (its title, skills, category)
 * and picks the image from the app's own library that shows that work: a
 * blouse job gets the tailoring photo, data entry gets the laptop-and-forms
 * photo, a pension scheme gets the coins. Nothing is random, so the same item
 * always shows the same picture.
 *
 * Only images that read well as a thumbnail are listed — no cut-outs on black.
 */

const A = (name: string) => `/ux/art/${name}.webp`;

/** Keyword → image, most specific first. */
const TOPICS: [RegExp, string][] = [
  [/solar|electric|technician|repair|install|plumb|mobile repair/i, A("work-dashboard-solar")],
  [/embroider|chikan|zardozi|aari|phulkari|kantha|mirror work|block print|weav|handloom|craft|artisan|jewel/i, A("work-dashboard-embroidery")],
  [/tailor|blouse|stitch|sew|kurta|salwar|lehenga|saree|alteration|uniform|boutique|garment|fashion design|pattern/i, A("work-dashboard-tailoring")],
  [/mehendi|mehndi|beaut|bridal|makeup|salon|thread|facial|skin|hair|nail|parlour|parlor/i, A("work-dashboard-beauty")],
  [/tiffin|cook|food|kitchen|cater|bake|baking|cake|pickle|papad|snack|canteen|hostel|meal|recipe|nutrition/i, A("work-dashboard-kitchen")],
  [/data entry|typing|excel|tally|account|bookkeep|book-keep|computer|office|clerk|billing|gst/i, A("work-dashboard-data")],
  [/graphic|canva|design/i, A("work-dashboard-design")],
  [/writ|content|translat|blog|journal/i, A("work-dashboard-writing")],
  [/social media|marketing|instagram|whatsapp|digital|online sell|sell online|e-?commerce|smartphone|phone basics/i, A("work-dashboard-social")],
  [/english|spoken|speak|confiden|interview|communicat|podcast/i, A("course-confident-microphone")],
  [/tuition|tutor|teach|anganwadi|child|creche|school|class \d|maths|science/i, A("work-dashboard-support")],
  [/photo|catalog|product shoot/i, A("course-photographing-handmade-product")],
  [/mentor|guidance|one to one|1:1|coach/i, A("course-video-call-mentor")],
  [/workshop|training|webinar|talk|seminar|bootcamp|leadership|present/i, A("course-presenting-to-group")],
  [/mela|market|stall|exhibition|fair|haat|bazaar|shop|selling|sell|product|order/i, A("course-handmade-market-stall")],
  // Government schemes, by who and what they are for — so a list of schemes
  // is not one picture of coins repeated.
  [/pregnan|matern|mother|baby|infant|daughter|girl child|sukanya|beti|anganwadi/i, A("work-dashboard-support")],
  [/pension|widow|old age|elder|senior|vridh/i, A("onboarding-all-ages-v2")],
  [/ration|food grain|nfsa|gas|lpg|ujjwala|cylinder/i, A("work-dashboard-kitchen")],
  [/mudra|loan|credit|business|udyam|enterprise|startup|stand.?up/i, A("earn-shop")],
  [/insurance|bima|suraksha|jeevan|accident|ayushman|pm-?jay|health cover/i, A("onboarding-help-safety-v2")],
  [/pension|scheme|yojana|subsid|loan|credit|bank|upi|saving|money|finance|budget|insurance|bima|cover|fund|grant|mudra|ration|gas|ujjwala/i, A("course-counting-coins-calculator")],
  [/right|legal|law|document|paper|aadhaar|certificate|proof|licen|fssai|udyam/i, A("scene-woman-reading-document")],
  [/health|well|yoga|meditat|period|cycle|mind|iron|menstru|pregnan|mother|doctor|clinic|anaemi|anemi/i, A("learn-dashboard-mindfulness")],
  [/support|help|helpline|counsel|call cent|customer|community|volunteer/i, A("work-dashboard-community")],
  [/circle|group|together|sisters|friends|meet/i, A("circle-hands-together")],
];

/** What each kind of thing falls back to — varied, so a list is not one picture repeated. */
const BY_KIND: Record<string, string[]> = {
  job: ["work-dashboard-writing", "work-dashboard-data", "work-dashboard-community", "work-dashboard-social"].map(A),
  course: ["course-reading-open-book", "course-working-laptop-smiling", "course-writing-notebook", "course-presenting-to-group"].map(A),
  mentor: ["course-video-call-mentor", "course-teaching-another-woman", "circle-sharing-help"].map(A),
  event: ["course-presenting-to-group", "circle-rooftop-evening", "circle-study-group", "circle-women-talking"].map(A),
  circle: ["circle-hands-together", "circle-women-talking", "circle-study-group", "circle-hands-joined", "circle-rooftop-evening", "circle-vision-board"].map(A),
  scheme: ["course-counting-coins-calculator", "earn-money", "learn-dashboard-finance"].map(A),
  product: ["course-handmade-market-stall", "earn-shop", "course-photographing-handmade-product"].map(A),
  service: ["earn-shop", "course-teaching-another-woman", "work-dashboard-community"].map(A),
  swap: ["circle-sharing-help", "circle-hands-joined", "earn-market"].map(A),
  story: ["circle-women-talking", "circle-rooftop-evening", "onboarding-circle-v2", "circle-vision-board"].map(A),
  health: ["learn-dashboard-mindfulness", "course-meditation", "onboarding-wellbeing-all-ages-v2"].map(A),
  money: ["course-counting-coins-calculator", "earn-money", "earn-wallet"].map(A),
  generic: ["circle-hands-together", "course-working-laptop-smiling", "onboarding-all-ages-v2"].map(A),
};

export type ArtKind = keyof typeof BY_KIND;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * The image for an item.
 *
 * @param about  everything that says what it is — title, skills, category —
 *               joined; the first topic that matches wins
 * @param kind   what it is, for the fallback when no topic matches
 * @param photo  its own picture, if it has one (always preferred)
 * @param seed   a stable id, so the fallback is varied but never changes
 */
export function artFor(about: string | (string | undefined | null)[], kind: ArtKind = "generic",
                       photo?: string | null, seed = ""): string {
  if (photo && photo.trim()) return photo;
  const text = Array.isArray(about) ? about.filter(Boolean).join(" ") : about || "";
  for (const [rx, img] of TOPICS) if (rx.test(text)) return img;
  const pool = BY_KIND[kind] ?? BY_KIND.generic;
  return pool[hash(seed || text) % pool.length];
}
