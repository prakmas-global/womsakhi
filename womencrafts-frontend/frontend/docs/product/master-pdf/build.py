import pathlib, base64
S = pathlib.Path("/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/pdf")
LOGO = (S / "logo.txt").read_text()
import json as _j
SHOTS = _j.loads((S / "shots.json").read_text()) if (S / "shots.json").exists() else {}
def phone(key, cap=""):
    src = SHOTS.get(key)
    if not src: return ""
    return ('<figure class="phone"><div class="ph-body"><span class="ph-notch"></span>'
            '<img src="' + src + '" alt=""/></div>'
            + ('<figcaption>' + cap + '</figcaption>' if cap else '') + '</figure>')

# ── the seven experience areas, their children, and the features inside them ──
# built=True only where the journey exists in the app today and I verified it.
AREAS = [
 ("My Day", "day", "Everything that needs her today, in one place", "#f5dfdf", "#9b4c62", [
   ("Home", True, ["Greeting and banner", "Next actions", "Quick check-in", "Chosen for you", "Shortcuts"]),
   ("My goals", True, ["Up to three goals", "Progress", "Done / Later / Not relevant"]),
   ("My journey", True, ["Milestones", "Certificates earned", "What changed"]),
   ("Saved", True, ["Saved items", "Collections", "Recently viewed"]),
   ("Calendar", True, ["Bookings", "Sessions", "Reminders due"]),
   ("Quiet controls", False, ["Attention budget", "Quiet hours", "Shared-device mode"]),
   ("Ask Sakhi", True, ["Labelled as AI", "Suggestion-only by default", "Preview before any write", "Hands off to a person"]),
 ]),
 ("Wellbeing", "well", "Optional, private, and never a condition of membership", "#e9ddfb", "#6f35f4", [
   ("Cycle tracker", True, ["One-tap daily log", "Calendar and phases", "Moods and symptoms", "Five-day check-in", "Discreet mode", "Export and delete"]),
   ("Motivation", True, ["Mood selection", "Reviewed encouragement", "Food and activity cards", "Quick replies"]),
   ("Health navigation", True, ["Guides", "Care cards", "Red-flag routing"]),
   ("Mentors and sessions", True, ["Directory", "Booking", "Questions"]),
   ("Health records", False, ["Member-entered", "Imported", "Professionally verified"]),
   ("Faith and scripture", False, ["Private preference", "Licensed passages", "Stop at any time"]),
 ]),
 ("Earn", "earn", "Her shop, her catalogue, her orders, her money", "#eaf0ea", "#007d38", [
   ("My shop", True, ["Create from a template", "Cover and profile", "Publish checks"]),
   ("Products and services", True, ["Photo-led listing", "Variants and stock", "Service slots"]),
   ("Orders", True, ["Incoming", "Fulfilment", "Cancellations and refunds"]),
   ("Seller tools", False, ["Photo cleanup", "Margin per order", "Registration guidance"]),
   ("Money and wallet", True, ["Earnings record", "Statement", "Withdraw", "Payout details"]),
   ("Bookkeeping", True, ["Season view", "Proof of trade", "What made money"]),
   ("Group selling", False, ["Group catalogue", "Shared outlet", "Assistant permissions"]),
 ]),
 ("Market", "market", "Where a buyer finds her, and fashion is a category not a second engine", "#fae0cf", "#a34b11", [
   ("Discover", True, ["Chosen for you", "Categories", "Filters and search"]),
   ("Fashion", True, ["Collections", "Sizes and fit", "Women-led sellers"]),
   ("Local services", False, ["Nearby providers", "Requests", "Offers"]),
   ("Checkout", False, ["Basket", "Price revalidation", "Receipts"]),
   ("After the order", False, ["Tracking", "Returns", "Disputes"]),
   ("Buy together", True, ["Group buys", "Join a buy", "Shared delivery"]),
 ]),
 ("Grow", "grow", "Learning, mentoring, work and what she is owed", "#eaeff4", "#006dbd", [
   ("Learn", True, ["Courses and lessons", "Progress", "Certificates"]),
   ("Mentors", True, ["Peer and professional scopes", "Booking", "Reviews"]),
   ("Jobs", True, ["Opportunities", "Applications", "Employer verification"]),
   ("Skills", True, ["Assessments", "Evidence of work", "Portfolio"]),
   ("Benefits", False, ["Eligibility explained", "Document checklist", "Deadline reminders"]),
   ("Recognition", False, ["Contribution record", "Official routes", "Returning to work"]),
   ("Certificates", True, ["Earned", "Shareable", "Verifiable"]),
   ("Teach and sell what you make", False, ["Lessons and downloads", "Licence and permitted use", "Versions and corrections"]),
   ("Step-by-step plan", False, ["A goal, in sequence", "Evidence she keeps", "Paired with saving", "Pause and resume"]),
 ]),
 ("Circles", "circ", "The women around her, and the groups that hold money and care", "#e9ddfb", "#6f35f4", [
   ("My circles", True, ["Join and leave", "Roles", "Invitations"]),
   ("Conversations", True, ["Posts", "Chat", "Reporting"]),
   ("Events", False, ["Create", "Capacity and waitlist", "Check-in"]),
   ("Savings groups", False, ["Meetings and attendance", "Contributions", "Internal lending records", "Ledger export"]),
   ("Care coordination", False, ["Requests", "Task board", "Elder-care rota"]),
   ("Together", True, ["Assisted set-up", "Learn together", "Operator access she controls"]),
 ]),
 ("My account", "lock", "Who she is here, what she agreed to, and how she leaves", "#f1eade", "#a34b11", [
   ("My profile", True, ["Name and photo", "What others see", "Verified badges"]),
   ("Settings", True, ["Language", "Text size and Simple view", "Appearance"]),
   ("Messages and alerts", True, ["What reaches her", "Quiet time", "Turn any of it off"]),
   ("My privacy", True, ["What is held", "Download everything", "Delete my account"]),
   ("Invite a friend", True, ["Share a link", "No contact uploads", "No messages sent for her"]),
   ("If something happens to me", False, ["Who may act", "What they may see", "Closing quietly"]),
 ]),
 ("Help and Safety", "safe", "Reachable on her worst day, and honest about its limits", "#f5dfdf", "#742a4f", [
   ("Get help now", True, ["Helplines", "Trusted contacts", "Alert and stand-down"]),
   ("Travel", False, ["Watcher group", "Server-side deadlines", "Escalation"]),
   ("Rights", True, ["Topics", "Country packs", "Named harms"]),
   ("Report and cases", True, ["Report", "Case with an owner", "Appeal"]),
   ("Crisis", False, ["Reviewed protocol", "Verified local services", "Quick exit"]),
   ("What she is owed", True, ["Entitlements", "Papers", "Recovering a claim"]),
   ("Spotting a scam", False, ["Advance fees", "Papers taken", "Move before agreeing", "Report it safely"]),
   ("If someone targets you", False, ["Photos shared without consent", "Someone pretending to be you", "Your address posted", "Protective measures"]),
 ]),
]

CROSS = [
 ("Mentors", "grow", "#e9ddfb", "#6f35f4", True,
  "One directory, one booking system, one set of scopes — surfaced wherever a woman needs a person rather than a page.",
  ["Peer, guide and verified professional are four distinct identities", "Reached from Learn, Work, Health, Earn, Circles and Help",
   "A badge states the reviewed scope, never universal expertise", "Booking, reschedule, no-show and complaint routes are shared"],
  ["Wellbeing", "Grow", "Earn", "Circles", "Help and Safety"]),
 ("Support and guides", "safe", "#f5dfdf", "#742a4f", True,
  "A WomSakhi guide helps her use the platform. Reachable from every screen, never buried in a menu.",
  ["Distinct from a peer mentor and from AI", "Published hours, and no claim of cover that is not staffed",
   "Escalates into a case with an owner", "She chooses what context to share"],
  ["My Day", "Wellbeing", "Earn", "Market", "Grow", "Circles", "Help and Safety"]),
 ("Ask Sakhi", "day", "#eaeff4", "#006dbd", True,
  "The assistant, labelled as AI everywhere it appears, and never the final authority on anything consequential.",
  ["Suggestion-only by default, per action type", "Previews any write before it happens",
   "Refuses unsupported advice and offers a human route", "Core logging, purchases and safety timing work without it"],
  ["My Day", "Wellbeing", "Earn", "Market", "Grow", "Circles", "Help and Safety"]),
 ("WomSakhi's own listings", "market", "#fae0cf", "#a34b11", False,
  "The platform's own programmes and services, alongside members' — always labelled as ours.",
  ["Clearly distinguished from a member's listing", "Same catalogue, orders and refund flow",
   "Never ranked above a relevant member listing without saying so", "Subject to the same reporting routes"],
  ["Market", "Grow", "Earn"]),
 ("Skills and things exchange", "earn", "#eaf0ea", "#007d38", True,
  "What she can swap rather than sell: a skill for a skill, a thing for a thing.",
  ["Swap listings and interest threads", "Conversation, then an agreement both sides record",
   "No money changes hands and no custody is implied", "Same reporting and blocking as commerce"],
  ["Earn", "Market", "Circles", "Grow"]),
 ("Documents and vault", "safe", "#f9f0ee", "#742a4f", True,
  "Her papers in one place, used by everything that asks for one.",
  ["Private by default, with its own history and privacy view", "Shared per document, per purpose, revocably",
   "Issuer-verified, member-uploaded and unverified kept distinct", "Feeds benefits, jobs, verification and contracts"],
  ["Grow", "Earn", "Help and Safety", "Circles"]),
 ("Verification and trust", "circ", "#e9ddfb", "#6f35f4", True,
  "Verified once, shown wherever it matters, and honest about what it proves.",
  ["Establishes that a record exists, never gender, safety or quality", "Credential scope and expiry are visible",
   "Expired credentials pause the services that depended on them", "Badges cannot be bought"],
  ["Earn", "Market", "Grow", "Circles", "Help and Safety"]),
]

SHARED = [
 ("Identity and consent", ["Sign-in and recovery", "Consent receipts", "Withdrawal that reaches queues"], False),
 ("Age and cohorts", ["Cohort resolution", "Guardian role", "Server-side enforcement"], False),
 ("Search", ["Scoped search", "Palette", "Voice entry"], True),
 ("Media and uploads", ["Secure handling", "Responsive variants", "Asset manifest"], True),
 ("Trust and cases", ["Report and block", "Evidence", "Appeals", "Transparency"], False),
 ("Audit and access", ["Staff scopes", "Break-glass", "Records"], False),
 ("Payments", ["Provider adapters", "Reconciliation", "Refunds"], False),
 ("Language", ["18 locales", "Speech and audio", "Reviewed high-stakes wording"], True),
 ("Country packs", ["Rails per country", "Legal reviewer", "Truthful coverage"], False),
 ("Security", ["Second factor", "Device review", "Testing and disclosure"], False),
 ("Works without internet", ["What still works", "Saved here or saved to your account", "Sends once, when it can"], False),
 ("Phone without internet", ["Call and hear a menu", "Help by voice", "Reply by recording"], False),
 ("Where information comes from", ["Source and date", "Rights checked", "Withdrawn when it changes"], False),
]

ENGINES = [
 ("Reminder Engine", "What needs attention, and when", "#e9ddfb", "#6f35f4",
  ["One-off, recurring and event-relative schedules", "Draft, Scheduled, Due, Snoozed, Completed, Cancelled, Expired",
   "Recalculates when the source task changes", "Survives worker restarts, no duplicate work",
   "Safety deadlines isolated from optional prompts"],
  "REM-UC-001 to 012"),
 ("Notification Engine", "One inbox, one policy, every module", "#eaeff4", "#006dbd",
  ["Categorized inbox with secure deep links", "In-app first, then permitted channels",
   "Quiet hours, attention budget, fatigue pause", "Deduplicate, expire, bounded retries",
   "Rechecks consent and state immediately before dispatch"],
  "NOTIFY-UC-001 to 012"),
 ("Recommendation", "Relevant, explainable, and switchable", "#eaf0ea", "#007d38",
  ["Ranks only opted-in material", "Shows its allowed inputs", "Can be switched off without losing the capability",
   "Never uses cycle, mood, incident or travel data", "Paid placement labelled, never in safety surfaces"],
  "AI-UC-001 to 010, GOV-UC-001 to 002"),
 ("Motivation", "Encouragement she asked for, and can stop", "#f5dfdf", "#9b4c62",
  ["She selects the mood; nothing is inferred", "One reviewed card, then quick replies",
   "One proactive prompt per local day at most", "Two unanswered prompts pause the series",
   "Serious distress routes to the reviewed protocol"],
  "CYCLE-UC-034 to 037, DAY-UC-011 to 013"),
]

FLOWS = [
 ("Arriving", "#f5dfdf", "#742a4f", ["Choose language", "Age and cohort", "Consent recorded", "Minimum profile", "Her home"]),
 ("A day logged", "#e9ddfb", "#6f35f4", ["One tap", "Mood, optional", "Day five: still bleeding?", "Reviewed care card", "Escalate if red flag"]),
 ("An order", "#eaf0ea", "#007d38", ["Listing", "Price revalidated", "Payment", "Fulfilment", "Refund or dispute"]),
 ("A journey watched", "#eaeff4", "#006dbd", ["Watchers accept", "Session starts", "Server holds the deadline", "Check-in or overdue", "Agreed escalation"]),
 ("A report", "#fae0cf", "#a34b11", ["Report", "Case with an owner", "Evidence preserved", "Decision", "Appeal to another reviewer"]),
 ("A reminder", "#f1eade", "#a34b11", ["Domain event", "Reminder due", "Policy check", "Dispatch", "Action returns to the domain"]),
]

ICONS = {
 "day": '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 "well": '<path d="M19 13c-1.8 3-4.6 5.4-7 7-2.4-1.6-5.2-4-7-7a4.3 4.3 0 0 1 7-4.7A4.3 4.3 0 0 1 19 13z"/>',
 "earn": '<path d="M4 8h16v12H4z"/><path d="M8 8V5a4 4 0 0 1 8 0v3"/>',
 "market": '<path d="M4 7h16l-1.4 12.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
 "grow": '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
 "circ": '<circle cx="9" cy="9" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8"/><path d="M18 20a5.5 5.5 0 0 0-3-4.6"/>',
 "safe": '<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9.5C7.4 20.2 4 17 4 12V6z"/>',
 "bell": '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
 "spark": '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
 "globe": '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.5-3.6-8.5S9.6 6.1 12 3.5z"/>',
 "lock": '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
}
def ico(k, size=20, sw=1.7):
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS.get(k, ICONS["spark"])}</svg>')

def badge(on):
    return '<span class="built">BUILT</span>' if on else ''


# ── plain names ─────────────────────────────────────────────────────────────
# A name has to work for a woman who reads slowly, in her second language, on a
# borrowed phone. Abstractions like "Wellbeing", "Grow" and "Circles" are English
# product words; "My health", "Learn & work" and "Groups" are things anybody can
# picture. The former name is kept beside the new one wherever it existed, so
# nothing in the specification becomes unfindable.
PLAIN = {
 # areas
 "My Day": "Today", "Wellbeing": "My health", "Earn": "Sell", "Market": "Buy",
 "Grow": "Learn & work", "Circles": "Groups", "Help and Safety": "Help",
 # modules
 "Quiet controls": "Quiet time", "My journey": "My progress",
 "Motivation": "Encouragement", "Health navigation": "Health guides",
 "Health records": "My health notes", "Faith and scripture": "Prayer & readings",
 "Products and services": "What I sell", "Seller tools": "Shop tools",
 "Money and wallet": "My money", "Bookkeeping": "Money in, money out",
 "Group selling": "Selling as a group", "After the order": "After you buy",
 "Local services": "People nearby", "Recognition": "Proof of my work",
 "Benefits": "Government help", "My circles": "My groups",
 "Conversations": "Messages", "Savings groups": "Saving together",
 "Care coordination": "Helping each other", "Together": "Set up with help",
 "Travel": "Travelling safely", "Rights": "My rights",
 "Report and cases": "Report a problem", "Crisis": "In danger now",
 "What she is owed": "Money owed to me",
 # services reached from everywhere
 "Support and guides": "Help from a person",
 "WomSakhi's own listings": "WomSakhi's own services",
 "Skills and things exchange": "Swap skills and things",
 "Documents and vault": "My papers", "Verification and trust": "Verified badges",
 # shared
 "Identity and consent": "Signing in and permission", "Age and cohorts": "Age rules",
 "Media and uploads": "Photos and files", "Trust and cases": "Reports and blocking",
 "Audit and access": "Who can see what", "Country packs": "Country rules",
 # engines
 "Reminder Engine": "Reminders", "Notification Engine": "Messages and alerts",
 "Recommendation": "Suggestions",
 # journeys
 "Arriving": "Joining", "A day logged": "Logging a day", "An order": "Buying something",
 "A journey watched": "Travelling safely", "A report": "Reporting a problem",
 "A reminder": "Getting a reminder",
}
def say(name):
    return PLAIN.get(name, name)
def was(name):
    p = PLAIN.get(name)
    return ('<span class="was">was ' + name + '</span>') if p else ""


pages = []

# ── 1. cover ────────────────────────────────────────────────────────────────
pages.append(f'''<section class="page cover">
  <div class="cover-art" aria-hidden="true">
    <div class="mesh m1"></div><div class="mesh m2"></div><div class="mesh m3"></div>
    <div class="cover-phone">{phone("home")}</div>
  </div>
  <div class="cover-body">
    <span class="mark ph-mark" role="img" aria-label="WomSakhi"></span>
    <p class="eyebrow">Product architecture</p>
    <h1>The product,<br/>in one place</h1>
    <p class="lede">Every module, what sits inside it, the engines underneath,
      and the journeys that cross them.</p>
    <div class="cover-meta">
      <div><b>685</b><span>capabilities specified</span></div>
      <div><b>47</b><span>areas</span></div>
      <div><b>45</b><span>testable journeys</span></div>
      <div><b>18</b><span>languages</span></div>
    </div>
    <p class="cover-foot">September 2026 &middot; Catalogue revision 2.10</p>
  </div>
</section>''')

def divider(num, title, sub, tint, ink, art=False):
    return ('<section class="page divider" style="--t:' + tint + ';--i:' + ink + '">'
            '<div class="dv-num">' + num + '</div>'
            '<div class="dv-body"><h2>' + title + '</h2><p>' + sub + '</p></div>'
            + ('<img class="dv-art" data-decor src="' + SHOTS.get("_art", "") + '" alt="" aria-hidden="true"/>' if art and SHOTS.get("_art") else "")
            + '</section>')

pages.append(divider("01", "The map", "What the product is, how its parts connect, and the services reached from everywhere.", "#742a4f", "#f3dad7", True))

# ── 2. what it is ───────────────────────────────────────────────────────────
area_cards = "".join(
 f'''<div class="ac" style="--t:{t};--i:{i}">
   <span class="ac-ico">{ico(k,22)}</span>
   <b>{say(n)}</b><span>{d}</span>
   <i>{len(ch)} modules</i>
 </div>''' for n, k, d, t, i, ch in AREAS)
pages.append(f'''<section class="page">
  {{HEAD}}
  <h2 class="ptitle">What WomSakhi is</h2>
  <p class="psub">Three outcomes, seven places to reach them, and one set of rules underneath.</p>
  <div class="three">
    <div class="three-c"><b>Trusted connection</b><p>Circles she chooses, conversations that are moderated, and people who are who they say they are.</p></div>
    <div class="three-c"><b>Earning</b><p>A shop she can open from a photograph, orders she can fulfil, and money that reaches an account in her own name.</p></div>
    <div class="three-c"><b>Everyday support</b><p>Her cycle, her rights, her documents, her safety — private by default and never a condition of membership.</p></div>
  </div>
  <h3 class="sub">The seven areas</h3>
  <div class="areas">{area_cards}</div>
</section>''')



# ── the naming rule ─────────────────────────────────────────────────────────
_rows = "".join(
  '<tr><td class="pn">' + v + '</td><td class="on">' + k + '</td></tr>'
  for k, v in list(PLAIN.items())[:26])
_rows2 = "".join(
  '<tr><td class="pn">' + v + '</td><td class="on">' + k + '</td></tr>'
  for k, v in list(PLAIN.items())[26:])
pages.append(f"""<section class="page">
  {{HEAD}}
  <h2 class="ptitle">The words we use</h2>
  <p class="psub">A name has to work for a woman who reads slowly, in her second language, on a borrowed phone.
    That rules out most product vocabulary.</p>
  <div class="names">
    <div class="nm-rule">
      <div class="nm-card"><b>Say the thing, not the concept</b>
        <p>&ldquo;Wellbeing&rdquo; is a category a designer invented. &ldquo;My health&rdquo; is something anybody can picture.
        Every name in this product is the plainest true word, not the most elegant one.</p></div>
      <div class="nm-card"><b>A verb she would use</b>
        <p>&ldquo;Earn&rdquo; and &ldquo;Market&rdquo; describe the business. <b>Sell</b> and <b>Buy</b> describe what she is doing,
        and they pair as opposites so one explains the other.</p></div>
      <div class="nm-card"><b>Never a word that judges</b>
        <p>No simple mode, no basic mode, nothing that names her as less. The easier view is
        <b>Simple view</b>; the help is <b>Help me</b>; the audio is <b>Listen</b>.</p></div>
      <div class="nm-card"><b>One name everywhere</b>
        <p>The same thing carries the same name in every screen, every language and every document.
        A second word for the same thing is a second thing, as far as she can tell.</p></div>
    </div>
    <div class="nm-table">
      <h3 class="sub">What changed</h3>
      <div class="nm-cols">
        <table><thead><tr><th>Now called</th><th>Was</th></tr></thead><tbody>{_rows}</tbody></table>
        <table><thead><tr><th>Now called</th><th>Was</th></tr></thead><tbody>{_rows2}</tbody></table>
      </div>
    </div>
  </div>
</section>""")

# ── 3. how it connects: hub diagram + matrix ────────────────────────────────
import math
cx, cy, R = 300, 150, 112
nodes = []
for idx, (n, k, d, t, i, ch) in enumerate(AREAS):
    a = -math.pi/2 + idx * (2*math.pi/len(AREAS))
    nodes.append((n, k, t, i, cx + R*math.cos(a), cy + R*math.sin(a)))
lines = "".join(
  f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{i}" stroke-width="1.1" opacity=".42"/>'
  for n, k, t, i, x, y in nodes)
dots = "".join(
  f'<g transform="translate({x:.1f},{y:.1f})">'
  f'<circle r="27" fill="{t}" stroke="{i}" stroke-width="1.2"/>'
  f'<text text-anchor="middle" y="3.5" font-size="8.2" font-weight="700" fill="{i}">'
  f'{n.split()[0][:9]}</text></g>' for n, k, t, i, x, y in nodes)
hub = f"""<svg viewBox="0 0 600 300" class="hub">
  <circle cx="{cx}" cy="{cy}" r="120" fill="none" stroke="#f3dad7" stroke-width="1" stroke-dasharray="3 4"/>
  {lines}
  <circle cx="{cx}" cy="{cy}" r="52" fill="#742a4f"/>
  <text x="{cx}" y="{cy-6}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff">SHARED</text>
  <text x="{cx}" y="{cy+6}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff">SPINE</text>
  <text x="{cx}" y="{cy+19}" text-anchor="middle" font-size="6.8" fill="#f3dad7">one of each, never seven</text>
  {dots}
</svg>"""
matrix_head = "".join(f'<th>{say(n).split()[0]}</th>' for n, k, d, t, i, ch in AREAS)
matrix_rows = "".join(
  '<tr><td class="rowh">' + say(cn) + badge(cb) + '</td>' +
  "".join(f'<td>{"<span class=dot></span>" if an in where else ""}</td>'
          for an, k, d, t, i, ch in AREAS) + '</tr>'
  for cn, ck, ct, ci, cb, cd, cpts, where in CROSS)
pages.append(f"""<section class="page">
  {{HEAD}}
  <h2 class="ptitle">How it connects</h2>
  <p class="psub">The seven areas are where she goes. The spine is what they all use — built once and reached from everywhere,
    so a mentor, a document or a report means the same thing wherever she finds it.</p>
  <div class="wire">
    <div class="wire-l">{hub}</div>
    <div class="wire-r">
      <b>Why a spine and not seven copies</b>
      <p>A mentor booked from Health is the same mentor, the same directory and the same complaint route as one booked
      from Work. A document proved once is proved everywhere. A person blocked in Circles cannot reach her in Market.</p>
      <p>The alternative — each area growing its own version — is how a product ends up with two inboxes, three
      definitions of verified, and a report that goes nowhere.</p>
      <div class="wire-k">
        <span><i style="background:#742a4f"></i>Shared spine</span>
        <span><i style="background:#f5dfdf;border:1px solid #9b4c62"></i>Experience area</span>
        <span><i class="ln"></i>Reaches and is reached</span>
      </div>
    </div>
  </div>
  <h3 class="sub">Which services appear in which area</h3>
  <table class="matrix"><thead><tr><th class="rowh">Service</th>{matrix_head}</tr></thead>
  <tbody>{matrix_rows}</tbody></table>
</section>""")

# ── 4. the cross-module services in full ────────────────────────────────────
cross_cards = "".join(
 f"""<div class="xc" style="--t:{t};--i:{i}">
   <div class="xc-h"><span class="xc-ico">{ico(k,20)}</span><b>{say(n)}</b>{badge(b)}</div>
   <p class="xc-d">{d}</p>
   <ul>{"".join(f"<li>{x}</li>" for x in pts)}</ul>
   <div class="xc-w"><i>Appears in</i>{"".join(f'<span>{w}</span>' for w in where)}</div>
 </div>""" for n, k, t, i, b, d, pts, where in CROSS)
pages.append(f"""<section class="page">
  {{HEAD}}
  <h2 class="ptitle">Seven services, reached from everywhere</h2>
  <p class="psub">These are not modules a woman visits. They are things she needs while she is somewhere else —
    so each is built once and surfaced wherever the need arises.</p>
  <div class="cross">{cross_cards}</div>
</section>""")

# ── 3–9. one page per area ──────────────────────────────────────────────────
SHOT_FOR = {"My Day": "home", "Wellbeing": "cycle", "Earn": "earn", "Market": "market",
            "Grow": "learn", "Circles": "circles", "Help and Safety": "help", "My account": "you"}
for n, k, d, t, i, children in AREAS:
    shot = phone(SHOT_FOR.get(n, ""), "Live in the app today")
    kids = "".join(
      f'''<div class="kid">
        <div class="kid-h"><b>{say(cn)}</b>{badge(cb)}</div>
        <div class="feats">{"".join(f'<span class="f">{x}</span>' for x in cf)}</div>
      </div>''' for cn, cb, cf in children)
    pages.append(f'''<section class="page" style="--t:{t};--i:{i}">
  {{HEAD}}
  <div class="area-head">
    <span class="area-ico">{ico(k,26)}</span>
    <div><h2 class="ptitle">{say(n)}</h2><p class="psub">{d} {was(n)}</p></div>
    <span class="count">{len(children)} modules</span>
  </div>
  <div class="area-body">
    <div class="tree">
      <div class="trunk"></div>
      <div class="kids">{kids}</div>
    </div>
    {shot}
  </div>
</section>''')

pages.append(divider("02", "The spine", "What every module inherits, the four engines, and the layers that decide what she is actually offered.", "#521e38", "#f3dad7"))

# ── 10. shared ──────────────────────────────────────────────────────────────
sh = "".join(
 f'''<div class="sc"><div class="sc-h"><b>{say(n)}</b>{badge(b)}</div>
   <div class="feats">{"".join(f'<span class="f">{x}</span>' for x in fs)}</div></div>'''
 for n, fs, b in SHARED)
pages.append(f'''<section class="page" style="--t:#f9f0ee;--i:#742a4f">
  {{HEAD}}
  <h2 class="ptitle">What every module inherits</h2>
  <p class="psub">Shared once, not rebuilt seven times. A module ships these with its first release, never after it.</p>
  <div class="shared">{sh}</div>
</section>''')

# ── 11. engines ─────────────────────────────────────────────────────────────
eng = "".join(
 f'''<div class="eng" style="--t:{t};--i:{i}">
   <div class="eng-h"><span class="eng-ico">{ico(ik,22)}</span><div><b>{say(n)}</b><span>{d}</span></div></div>
   <ul>{"".join(f"<li>{x}</li>" for x in pts)}</ul>
   <i class="ids">{ids}</i>
 </div>''' for (n, d, t, i, pts, ids), ik in zip(ENGINES, ["clock", "bell", "spark", "well"]))
pages.append(f'''<section class="page">
  {{HEAD}}
  <h2 class="ptitle">The four engines</h2>
  <p class="psub">Every module asks the same four questions. They are answered once, in one place, under one policy.</p>
  <div class="engines">{eng}</div>
  <div class="engine-flow">
    <b>How a thing becomes a message</b>
    <div class="chain">
      <span class="ch">Something changes in a module</span><span class="ar">&rarr;</span>
      <span class="ch">Reminder decides when it matters</span><span class="ar">&rarr;</span>
      <span class="ch">Policy checks consent, quiet hours, budget</span><span class="ar">&rarr;</span>
      <span class="ch">Notification delivers it once</span><span class="ar">&rarr;</span>
      <span class="ch">Her answer returns to the module</span>
    </div>
    <p class="note">AI may propose the timing or the wording. It cannot change a permission, a deadline or a recipient.</p>
  </div>
</section>''')

# ── 12. cross-cutting ───────────────────────────────────────────────────────
pages.append(f'''<section class="page">
  {{HEAD}}
  <h2 class="ptitle">The layers under all of it</h2>
  <p class="psub">Four things decide what a given woman, in a given country, at a given age, is actually offered.</p>
  <div class="layers">
    <div class="layer" style="--t:#eaeff4;--i:#006dbd"><span>{ico("globe",22)}</span><b>Country packs</b>
      <p>One product, many countries. Each pack records its own identity service, benefits sources, payment rail,
      safety numbers, group-savings law, languages and data-protection regime — with a named local reviewer.
      A country without a pack says so truthfully rather than showing another country's answer.</p></div>
    <div class="layer" style="--t:#f5dfdf;--i:#9b4c62"><span>{ico("circ",22)}</span><b>Age and cohorts</b>
      <p>All ages are in scope, with age-appropriate experiences rather than one adult feature set.
      Enforced server-side on APIs, uploads, search, exports and deep links — not merely hidden from navigation.
      An adult invitation cannot promote a child into adult access.</p></div>
    <div class="layer" style="--t:#f9f0ee;--i:#742a4f"><span>{ico("lock",22)}</span><b>Trust and safety</b>
      <p>Report, block, evidence, cases with owners, appeals to a different reviewer, and named harms —
      image-based abuse, impersonation, coercive control. Moderators cannot browse health records or private
      messages without an authorized case purpose.</p></div>
    <div class="layer" style="--t:#e9ddfb;--i:#6f35f4"><span>{ico("spark",22)}</span><b>Design system</b>
      <p>One token source for colour, type, spacing, radius, motion and targets. 44px touch floors,
      4.5:1 contrast measured against what is actually painted, 18 languages with scripts that render,
      and every screen verified at six widths in both themes.</p></div>
  </div>
</section>''')

# ── 13. flows ───────────────────────────────────────────────────────────────
fl = "".join(
 f'''<div class="flow" style="--t:{t};--i:{i}">
   <b>{say(n)}</b>
   <div class="steps">{"".join(f'<span class="st">{s}</span>' + ('<span class="ar">&rarr;</span>' if j < len(ss)-1 else '') for j, s in enumerate(ss))}</div>
 </div>''' for n, t, i, ss in FLOWS)
pages.append(f'''<section class="page">
  {{HEAD}}
  <h2 class="ptitle">Six journeys that cross the map</h2>
  <p class="psub">Modules are how the product is organised. These are how it is used.</p>
  <div class="flows">{fl}</div>
</section>''')


# ── our promises, and the catalogue coverage map ────────────────────────────
pages.append(f"""<section class="page">
  {{HEAD}}
  <h2 class="ptitle">Our promises</h2>
  <p class="psub">The parts of a product nobody puts on a feature list, and everybody judges it by.</p>
  <div class="promises">
    <div class="pr" style="--t:#f5dfdf;--i:#742a4f"><span>{ico("lock",20)}</span>
      <b>What we are, and are not</b>
      <p>Sellers sell; a partner carries the goods; WomSakhi holds neither the items nor the money.
      That position is earned by doing the work — showing who the seller is, holding an agreement with her,
      and answering complaints within a stated time — not by writing it in the terms.</p>
      <i>Terms &middot; 12 commitments</i></div>
    <div class="pr" style="--t:#e9ddfb;--i:#6f35f4"><span>{ico("globe",20)}</span>
      <b>What we hold about her</b>
      <p>A notice that stands on its own, in her language, itemising what is collected and why.
      Each purpose refusable on its own. Her cycle, mood, safety sessions, case details, faith and
      exact location never reach analytics, advertising or a funder.</p>
      <i>Privacy &middot; 12 commitments</i></div>
    <div class="pr" style="--t:#eaeff4;--i:#006dbd"><span>{ico("safe",20)}</span>
      <b>When the law asks</b>
      <p>One named recipient, authenticity verified, the minimum actually compelled — never a whole account
      because a whole account was asked for. She is told unless telling her is unlawful, and the totals
      are published.</p>
      <i>Lawful process &middot; 8 commitments</i></div>
    <div class="pr" style="--t:#eaf0ea;--i:#007d38"><span>{ico("earn",20)}</span>
      <b>How this pays for itself</b>
      <p>Institutions that already fund these outcomes first; buyer-side and delivery margin second;
      a member paying last and only where it is worth it. Never a cut of a seller's thin margin, and never
      a price set by her mood, health or distress.</p>
      <i>Revenue &middot; 18 commitments</i></div>
    <div class="pr wide" style="--t:#f9f0ee;--i:#742a4f"><span>{ico("clock",20)}</span>
      <b>If WomSakhi ever stops</b>
      <p>She is told before anything stops working. She exports her records and her papers. A savings group
      receives its own ledger, reconciled. Open obligations are settled rather than abandoned. Nothing is
      deleted quietly and nothing is handed to anyone else without a lawful basis and notice.
      A product that asks a woman to keep her livelihood here should be able to answer this before she asks.</p>
      <i>Governance and endings &middot; 10 commitments</i></div>
  </div>
</section>""")

_COVER_MAP = [
 ("Today", ["DAY — everyday actions", "GROWTH — inviting a friend"]),
 ("My health", ["CYCLE — tracking and moods", "HEALTH — guides and care", "SPIRIT — prayer and readings", "CRISIS — acute distress"]),
 ("Sell", ["EARN — shop, orders, tools", "MONEY — records and wallet", "RECOG — proof of her work"]),
 ("Buy", ["FASHION — a category", "LOCAL — people nearby", "EVENT — workshops and meetups"]),
 ("Learn & work", ["LEARN — courses and mentors", "JOBS — work and applications", "BENEFIT — government help", "CREATOR — teaching and selling what she makes", "GRAD — step-by-step plans"]),
 ("Groups", ["CIRCLE — groups and messages", "SAVEGRP — saving together", "CARE — helping each other"]),
 ("Help", ["SAFE — helplines and travel", "RIGHTS — her rights", "TRUST — reports and cases", "HARM — named harms", "RISK — scams and exploitation"]),
 ("My account", ["AUTH — signing in", "PRIV — what is held", "LIFE — dormancy and death", "TERMS — what we are"]),
 ("Reached from everywhere", ["AI — the assistant", "DOC — her papers", "PLAT — search, media, profiles"]),
 ("Every module inherits", ["AGE — cohorts", "LANG — language and speech", "SEC — security", "PACK — country rules", "OFF — offline", "REACH — voice and basic phones", "DATA — where content comes from", "ASSET — imagery", "UX / DESIGN — how it looks and behaves"]),
 ("The engines", ["REM — reminders", "NOTIFY — messages and alerts"]),
 ("Our promises", ["LAW — lawful requests", "GOV — governance and endings", "REV — how it pays for itself"]),
]
_map_rows = "".join(
  '<div class="cm"><b>' + home + '</b><ul>' +
  "".join('<li>' + it + '</li>' for it in items) + '</ul></div>'
  for home, items in _COVER_MAP)
pages.append(f"""<section class="page">
  {{HEAD}}
  <h2 class="ptitle">Everything in the specification, and where it lives</h2>
  <p class="psub">All 47 areas of the catalogue, mapped to the place in the product a woman would find them.
    Nothing specified is without a home; nothing shown here is without a specification.</p>
  <div class="covermap">{_map_rows}</div>
</section>""")

# ── the complete tree, drawn as a hierarchy ─────────────────────────────────
def branch_html(br):
    gname, gk, gt, gi, items = br
    kids = "".join(
      '<li class="t-kid"><span class="t-n">' + kn + '</span>' + badge(kb) +
      '<span class="t-f">' + " · ".join(kf) + '</span></li>' for kn, kb, kf in items)
    return ('<div class="t-branch" style="--t:' + gt + ';--i:' + gi + '">' +
            '<div class="t-root"><span class="t-ico">' + ico(gk, 17) + '</span><b>' + say(gname) + '</b>' +
            '<i>' + str(len(items)) + '</i></div>' +
            '<ul class="t-kids">' + kids + '</ul></div>')

def tree_cols(title, sub, columns):
    cols = "".join('<div class="t-col">' + "".join(branch_html(b) for b in col) + '</div>'
                   for col in columns)
    return ('<section class="page tree-page">{HEAD}'
            '<h2 class="ptitle">' + title + '</h2>'
            '<p class="psub">' + sub + '</p>'
            '<div class="tree-cols">' + cols + '</div></section>')

def tree_block(title, sub, groups):
    out = []
    for gname, gk, gt, gi, items in groups:
        kids = "".join(
          '<li class="t-kid"><span class="t-n">' + kn + '</span>' + badge(kb) +
          '<span class="t-f">' + " · ".join(kf) + '</span></li>' for kn, kb, kf in items)
        out.append(
          '<div class="t-branch" style="--t:' + gt + ';--i:' + gi + '">' +
          '<div class="t-root"><span class="t-ico">' + ico(gk, 17) + '</span><b>' + say(gname) + '</b>' +
          '<i>' + str(len(items)) + '</i></div>' +
          '<ul class="t-kids">' + kids + '</ul></div>')
    return ('<section class="page tree-page">{HEAD}'
            '<h2 class="ptitle">' + title + '</h2>'
            '<p class="psub">' + sub + '</p>'
            '<div class="tree-grid">' + "".join(out) + '</div></section>')

pages.append(divider("03", "In full", "Every area, module and feature, drawn as one hierarchy.", "#6f35f4", "#e9ddfb"))

# Branches are packed by their MEASURED height, not an estimate: a branch's
# height depends on how its feature lines wrap, and a page's height is set by
# its taller column. measure.py renders each branch and writes heights.json;
# if that file is absent the packer falls back to a conservative row count.
import json as _json
_hfile = S / "heights.json"
_heights = _json.loads(_hfile.read_text()) if _hfile.exists() else {}

_branches = (
  [(n, k, t, i, ch) for n, k, d, t, i, ch in AREAS]
  + [("Reached from everywhere", "spark", "#f9f0ee", "#742a4f",
      [(n, bd, where) for n, k, t, i, bd, d, pts, where in CROSS])]
  + [("Every module inherits", "lock", "#f9f0ee", "#742a4f",
      [(n, bd, fs) for n, fs, bd in SHARED])]
  + [("The engines", "clock", "#e9ddfb", "#6f35f4",
      [(n, False, [d]) for n, d, t, i, pts, ids in ENGINES])])

def _h(br):
    return _heights.get(br[0], 34 + 26 * len(br[4]))

# two columns per page; a column may hold up to COLMAX px of branches plus gaps
_COLMAX, _GAP = 612, 19
_cols, _cur, _y = [], [], 0
for _b in _branches:
    _bh = _h(_b)
    if _cur and _y + _GAP + _bh > _COLMAX:
        _cols.append(_cur); _cur, _y = [], 0
    _cur.append(_b); _y += (_GAP if _y else 0) + _bh
if _cur: _cols.append(_cur)

_pages_of = [_cols[i:i + 2] for i in range(0, len(_cols), 2)]
_sub_first = "Every area, every module inside it, every feature inside that."
_sub_rest = "Continued: the remaining branches, the spine every area shares, and the engines."
for _n, _cc in enumerate(_pages_of):
    _t = f"The complete tree &middot; {_n + 1} of {len(_pages_of)}"
    pages.append(tree_cols(_t, _sub_first if _n == 0 else _sub_rest, _cc))

# ── 14. closing ─────────────────────────────────────────────────────────────
pages.append(f'''<section class="page closing">
  {{HEAD}}
  <h2 class="ptitle">What this map is for</h2>
  <div class="close-grid">
    <div>
      <p class="big">A woman opening WomSakhi is not shopping for features. She has one thing she needs today —
      money that arrives, a group that answers, a body she wants to understand, or a way out.</p>
      <p>The architecture exists so that whichever door she comes through, the rest is there when she needs it:
      the same identity, the same consent, the same reminders, the same protections.</p>
      <p>Everything on these pages is specified to the level of a testable outcome, with its dependencies,
      its gates and the decisions that belong to a clinician, a lawyer or a safeguarding owner rather than
      to engineering.</p>
    </div>
    <div class="close-stats">
      <div><b>7</b><span>experience areas</span></div>
      <div><b>47</b><span>capability areas</span></div>
      <div><b>685</b><span>specified capabilities</span></div>
      <div><b>45</b><span>testable journeys</span></div>
      <div><b>4</b><span>shared engines</span></div>
      <div><b>18</b><span>languages</span></div>
    </div>
  </div>
  <p class="legend"><span class="built">BUILT</span> marks what already runs in the application today.
  Everything else is specified and planned.</p>
</section>''')

HEAD = ('<header class="ph"><span class="ph-mark" role="img" aria-label="WomSakhi"></span>'
        '<span>Product architecture</span></header>')
body = "\n".join(p.replace("{HEAD}", HEAD) for p in pages)
(S / "body.html").write_text(body)

# measurement harness — one column, real width, no grid stretching
_m = "".join('<div class="t-col measure-col">' + branch_html(_b) + "</div>" for _b in _branches)
(S / "measure_body.html").write_text(_m)
print("pages:", len(pages))
