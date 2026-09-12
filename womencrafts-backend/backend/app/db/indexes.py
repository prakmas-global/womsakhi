"""
Database indexes.

Every member-facing query filters by `user_id`. Without an index that is a full
collection scan on every request — invisible at 8 members, crippling at 8,000,
and the kind of thing that is painful to retrofit once real data exists.

Indexes are created at startup and are idempotent: Mongo ignores one that
already matches, so this is safe to run on every boot.

Compound indexes follow the ESR rule — Equality fields first, then Sort, then
Range — because that is the order Mongo can actually use them in. `bookings`
is the clearest example: filter by user + status (equality), sort by date.
"""

from pymongo import ASCENDING, DESCENDING, IndexModel

from app.db.mongodb import get_database

# collection -> indexes it needs
INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        # Sign-in looks up by email on every attempt; unique also stops two
        # accounts racing to claim the same address.
        IndexModel([("email", ASCENDING)], unique=True, name="email_unique"),
        # The verification queue: "members awaiting review".
        IndexModel([("role", ASCENDING), ("verification_status", ASCENDING)], name="role_status"),
        IndexModel([("member_id", ASCENDING)], name="member_id", sparse=True),
        # Her shop's public handle. UNIQUE because the index is what decides a
        # collision — `handle_for` simply takes the next number when this
        # refuses — and SPARSE because most accounts never have one, and a
        # plain unique index would make every one of those collide on null.
        IndexModel([("shop_handle", ASCENDING)], unique=True, sparse=True, name="shop_handle_unique"),
    ],
    "members": [
        IndexModel([("email", ASCENDING)], name="email"),
        IndexModel([("code", ASCENDING)], name="code"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],
    # ── Her business ───────────────────────────────────────────────────
    "shop_listings": [
        IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated"),
        IndexModel([("user_id", ASCENDING), ("kind", ASCENDING)], name="user_kind"),
        # The market browse: live listings that are not hers, newest first.
        IndexModel([("status", ASCENDING), ("updated_at", DESCENDING)], name="live_updated"),
    ],
    "shop_orders": [
        # "my orders, newest first" and "who is waiting on me"
        IndexModel([("seller_id", ASCENDING), ("created_at", DESCENDING)], name="seller_created"),
        IndexModel([("seller_id", ASCENDING), ("state", ASCENDING)], name="seller_state"),
        # The other side: what I have ordered, and whether I have ordered THIS.
        IndexModel([("buyer_id", ASCENDING), ("created_at", DESCENDING)], name="buyer_created"),
        IndexModel([("buyer_id", ASCENDING), ("listing_id", ASCENDING)], name="buyer_listing"),
    ],
    "shop_reviews": [
        IndexModel([("seller_id", ASCENDING), ("created_at", DESCENDING)], name="seller_created"),
    ],

    # ── Skill exchange ─────────────────────────────────────────────────
    "skill_swaps": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("user_id", ASCENDING)], name="mine"),
        IndexModel([("tags", ASCENDING)], name="tags"),
    ],
    "skill_exchanges": [
        # One thread per pair per swap — asking twice continues the
        # conversation rather than starting a second one she has to notice.
        IndexModel([("swap_id", ASCENDING), ("asker_id", ASCENDING)], unique=True, name="swap_asker_unique"),
        IndexModel([("owner_id", ASCENDING), ("updated_at", DESCENDING)], name="owner_updated"),
        IndexModel([("asker_id", ASCENDING), ("updated_at", DESCENDING)], name="asker_updated"),
    ],

    # ── Goals ──────────────────────────────────────────────────────────
    "goals": [
        # `/wallet/insights` asks for her open MONEY goal. The key below starts
        # user_id + status, so `kind` was matched by scanning whatever came
        # back — fine at five goals, not at five per member.
        IndexModel(
            [("user_id", ASCENDING), ("kind", ASCENDING), ("status", ASCENDING),
             ("created_at", DESCENDING)],
            name="user_kind_status_recent",
        ),
        # "what I am working towards", newest first — the only query it serves.
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)],
                   name="user_status_created"),
    ],

    # ── Getting paid ───────────────────────────────────────────────────
    "payout_accounts": [
        # Primary first, then newest — the exact sort the accounts list uses.
        IndexModel([("user_id", ASCENDING), ("primary", DESCENDING), ("created_at", DESCENDING)],
                   name="user_primary_created"),
    ],

    # ── Safety nets ────────────────────────────────────────────────────
    "idempotency_keys": [
        # This unique index IS the mechanism. `core/idempotency.py` claims a key
        # by inserting it and lets the database decide which of two simultaneous
        # retries wins — a read-then-write check loses that race, which is the
        # exact race the module exists to close.
        IndexModel(
            [("user_id", ASCENDING), ("scope", ASCENDING), ("key", ASCENDING)],
            unique=True, name="user_scope_key_unique",
        ),
        # A retry a day later is a new intent, not a repeat. Mongo expires these
        # itself, so nothing has to remember to sweep them.
        IndexModel([("created_at", ASCENDING)], expireAfterSeconds=86400, name="ttl_1d"),
    ],

    # ── Buying together ────────────────────────────────────────────────
    "group_buys": [
        IndexModel([("status", ASCENDING), ("closes_at", ASCENDING)], name="status_closes"),
    ],
    "group_buy_joiners": [
        # One join per woman per buy. The threshold arithmetic in
        # `routes/group_buy.py` is only correct if this holds.
        IndexModel([("user_id", ASCENDING), ("buy_id", ASCENDING)], unique=True, name="user_buy_unique"),
        IndexModel([("buy_id", ASCENDING)], name="buy"),
    ],

    # ── Skills ─────────────────────────────────────────────────────────
    "assessments": [
        IndexModel([("status", ASCENDING), ("skill", ASCENDING)], name="status_skill"),
    ],
    "assessment_attempts": [
        # "every attempt I have made" — the list that computes her best score.
        IndexModel([("user_id", ASCENDING), ("assessment_id", ASCENDING)], name="user_assessment"),
    ],
    "digital_steps": [
        IndexModel([("n", ASCENDING)], name="order"),
    ],
    "digital_progress": [
        IndexModel([("user_id", ASCENDING), ("step_id", ASCENDING)], unique=True, name="user_step_unique"),
    ],

    # ── What she is entitled to ────────────────────────────────────────
    "reference": [
        # The only query this collection ever serves: a topic, near her or
        # everywhere, published, in curated order. One index covers the filter
        # and the sort together, which is the ESR rule doing its job.
        IndexModel(
            [("topic", ASCENDING), ("status", ASCENDING), ("city", ASCENDING),
             ("rank", ASCENDING)],
            name="topic_status_city_rank",
        ),
        # "What is free" is a first-class filter, because cost is one of the two
        # reasons a woman does not use what she is owed.
        IndexModel([("topic", ASCENDING), ("free", ASCENDING), ("rank", ASCENDING)], name="topic_free_rank"),
    ],
    "reference_mine": [
        IndexModel([("user_id", ASCENDING), ("topic", ASCENDING)], name="user_topic"),
        # One record of what she has done per entry — the upsert in
        # `routes/reference.py` relies on this to stay one under a double tap.
        IndexModel([("user_id", ASCENDING), ("ref_id", ASCENDING)], unique=True, name="user_ref_unique"),
    ],
    "saved": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("user_id", ASCENDING), ("kind", ASCENDING), ("created_at", DESCENDING)], name="user_kind_created"),
        # The bookmark is idempotent because of this line. Without it, the
        # upsert in `routes/saved.py` can still double under a race.
        IndexModel(
            [("user_id", ASCENDING), ("kind", ASCENDING), ("ref_id", ASCENDING)],
            unique=True, name="user_kind_ref_unique",
        ),
    ],
    "bookings": [
        # "my upcoming bookings, soonest first"
        IndexModel(
            [("user_id", ASCENDING), ("status", ASCENDING), ("date", ASCENDING)],
            name="user_status_date",
        ),
        # the duplicate-slot check
        IndexModel(
            [("user_id", ASCENDING), ("service_id", ASCENDING), ("date", ASCENDING), ("time", ASCENDING)],
            name="user_slot",
        ),
    ],
    "enrollments": [
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING)], name="user_status"),
        # one enrolment per member per program — enforced by the DB, not just code
        IndexModel(
            [("user_id", ASCENDING), ("program_id", ASCENDING)],
            unique=True,
            name="user_program_unique",
        ),
        IndexModel([("program_id", ASCENDING)], name="program"),
    ],
    "member_messages": [
        # Her unread count and the "mark my thread read" write both match on
        # user_id + read_by_member; the existing keys cover neither pair.
        IndexModel([("user_id", ASCENDING), ("read_by_member", ASCENDING)], name="user_unread_member"),
        IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)], name="thread"),
        # the staff inbox's unread counter
        IndexModel([("read_by_team", ASCENDING)], name="unread_team"),
    ],
    "member_notifications": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        IndexModel([("user_id", ASCENDING), ("unread", ASCENDING)], name="user_unread"),
    ],
    "orders": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        # idempotent order lookup: same member, same thing, still open
        IndexModel(
            [("user_id", ASCENDING), ("purpose", ASCENDING), ("reference_id", ASCENDING), ("status", ASCENDING)],
            name="user_reference_status",
        ),
        # webhooks arrive knowing only the provider's id
        IndexModel([("provider_payment_id", ASCENDING)], name="provider_payment", sparse=True),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_recent"),
    ],
    "refunds": [
        IndexModel([("order_id", ASCENDING)], name="order"),
        IndexModel([("user_id", ASCENDING)], name="user"),
    ],
    "verification_documents": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "email_tokens": [
        IndexModel([("token", ASCENDING)], unique=True, name="token_unique"),
        # Mongo deletes expired tokens by itself — a used-up secret should not
        # linger in the database waiting to become someone's problem.
        IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0, name="ttl"),
    ],
    "uploads": [
        IndexModel([("kind", ASCENDING), ("created_at", DESCENDING)], name="kind_recent"),
    ],

    # --- community -----------------------------------------------------------
    "circles": [
        IndexModel([("status", ASCENDING), ("member_count", DESCENDING)], name="status_popular"),
    ],
    "circle_members": [
        # "am I in this circle?" — the permission check on every private read
        IndexModel(
            [("user_id", ASCENDING), ("circle_id", ASCENDING)],
            unique=True,
            name="user_circle_unique",
        ),
        IndexModel([("circle_id", ASCENDING)], name="circle"),
    ],
    "circle_contributions": [
        # The rule that makes paying twice for one round impossible. It is a
        # unique index rather than a read-then-write check because two taps
        # arriving together both pass a check and only one can win an index.
        IndexModel(
            [("circle_id", ASCENDING), ("user_id", ASCENDING), ("round", ASCENDING)],
            unique=True,
            name="circle_user_round_unique",
        ),
        # "who has paid this round" — the pay screen's first question.
        IndexModel([("circle_id", ASCENDING), ("round", ASCENDING)], name="circle_round"),
    ],
    "circle_posts": [
        # the feed: one circle, pinned first, newest next
        IndexModel(
            [("circle_id", ASCENDING), ("pinned", DESCENDING), ("created_at", DESCENDING)],
            name="circle_feed",
        ),
        IndexModel([("user_id", ASCENDING)], name="author"),
    ],
    "post_replies": [
        IndexModel([("post_id", ASCENDING), ("created_at", ASCENDING)], name="post_thread"),
    ],
    "stories": [
        IndexModel(
            [("status", ASCENDING), ("featured", DESCENDING), ("published_at", DESCENDING)],
            name="published_feed",
        ),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="mine"),
    ],

    # --- growth --------------------------------------------------------------
    "events": [
        # "what's coming up" — published events from today onwards
        IndexModel([("status", ASCENDING), ("date", ASCENDING)], name="status_date"),
        IndexModel([("category", ASCENDING), ("date", ASCENDING)], name="category_date"),
    ],
    "event_registrations": [
        IndexModel(
            [("user_id", ASCENDING), ("event_id", ASCENDING)],
            unique=True,
            name="user_event_unique",
        ),
        IndexModel([("event_id", ASCENDING), ("status", ASCENDING)], name="event_status"),
    ],
    "mentors": [
        IndexModel([("status", ASCENDING), ("rating", DESCENDING)], name="status_rating"),
        IndexModel([("expertise", ASCENDING)], name="expertise"),
    ],
    "mentorship_requests": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        IndexModel([("mentor_id", ASCENDING), ("status", ASCENDING)], name="mentor_status"),
    ],
    "opportunities": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="open_recent"),
        IndexModel([("kind", ASCENDING), ("status", ASCENDING)], name="kind_status"),
        # "open work, paid monthly, best first". ESR: status and period are
        # equality, the pay is the sort. The period must be in the key — money
        # per piece and money per month are not on the same scale, and an index
        # that mixed them would sort ₹180-per-piece above ₹15,000-per-month.
        IndexModel(
            [("status", ASCENDING), ("pay_period", ASCENDING), ("pay_low_minor", DESCENDING)],
            name="open_period_pay",
        ),
        # `mode` is a filter on the member work board (Remote / On-site / Hybrid)
        # and had no index; it was a collection scan behind the status match.
        IndexModel([("status", ASCENDING), ("mode", ASCENDING)], name="status_mode"),
    ],
    "applications": [
        # one application per member per opportunity — enforced by the DB
        IndexModel(
            [("user_id", ASCENDING), ("opportunity_id", ASCENDING)],
            unique=True,
            name="user_opportunity_unique",
        ),
        IndexModel([("opportunity_id", ASCENDING), ("status", ASCENDING)], name="opportunity_status"),
    ],


    # ── the catalogue ──────────────────────────────────────────────────
    #
    # These four collections had NO indexes at all — only the _id_ Mongo
    # creates for you. Every one of them backs a screen a member opens, and
    # every query on them was a full collection scan. They are small today
    # (28 programmes, 41 services, 16 library items, 5 invoices), which is
    # precisely the moment to add these: this file's own opening note is that
    # a missing index is invisible at 8 rows and crippling at 8,000, and
    # painful to retrofit once real data exists.
    "programs": [
        # "programmes I can join, newest first" — the member catalogue.
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("category", ASCENDING), ("status", ASCENDING)], name="category_status"),
    ],
    "services": [
        # Same screen for services, except it sorts by popularity, not date.
        # ESR: status is the equality match, bookings is the sort.
        IndexModel([("status", ASCENDING), ("bookings", DESCENDING)], name="status_bookings"),
        IndexModel([("type", ASCENDING), ("status", ASCENDING)], name="type_status"),
    ],
    "content_items": [
        # Her library, newest first.
        IndexModel([("created_at", DESCENDING)], name="recent"),
        # Every read of this collection filters on status before sorting by
        # date — her library asks for Published, the admin list asks for one
        # tab. With only the date index that was a scan of every item to throw
        # most of them away.
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_recent"),
    ],
    "invoices": [
        IndexModel([("status", ASCENDING)], name="status"),
    ],

    # --- safety --------------------------------------------------------------
    "trusted_contacts": [
        IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)], name="user_contacts"),
    ],
    "safety_alerts": [
        # the staff queue: open alerts, most recent first
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_recent"),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
    ],
    "safety_reports": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_recent"),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
    ],

    # --- money and credentials -----------------------------------------------
    "wallet_transactions": [
        # the balance aggregation and the ledger screen both read this
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_ledger"),
    ],
    # Her inbox: buyer questions, circle threads, staff replies.
    #
    # This collection had no entry here at all, while the cluster carried a
    # `member_id_1` index somebody added by hand. So the live database was fine
    # and a fresh deployment would have had nothing — the drift was invisible
    # precisely because it only showed up somewhere nobody was looking. Named
    # to match what is already there, so this is idempotent against both.
    #
    # `member_id` alone is enough: `kind` narrows a handful of rows per member,
    # and a compound index that saves nothing still costs on every write.
    "member_conversations": [
        IndexModel([("member_id", ASCENDING)], name="member_id_1"),
        # Finding the one thread she already has with another member. Not
        # unique: every seeded thread has no `with_user_id` at all, and a
        # unique index would make them all collide on null.
        IndexModel([("member_id", ASCENDING), ("with_user_id", ASCENDING)], name="member_with"),
    ],
    "support_requests": [
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING)], name="user_status"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="queue"),
    ],
    "platform_settings": [
        IndexModel([("_key", ASCENDING)], unique=True, name="singleton"),
    ],
    "staff_notification_prefs": [
        IndexModel([("user_id", ASCENDING)], unique=True, name="user_unique"),
    ],
    "activity_log": [
        # "what did I do lately" and the per-day/per-category rollups
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        IndexModel([("created_at", DESCENDING)], name="recent"),
        IndexModel([("category", ASCENDING), ("created_at", DESCENDING)], name="category_recent"),
    ],
    "support_tickets": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="queue"),
        IndexModel([("reference", ASCENDING)], unique=True, name="reference_unique"),
    ],
    "backups": [
        IndexModel([("created_at", DESCENDING)], name="recent"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "user_layouts": [
        # One document per person, always fetched by owner. Unique because a
        # second layout row for the same user would mean her app looks
        # different depending on which one Mongo returned first.
        IndexModel([("user_id", ASCENDING)], unique=True, name="user_unique"),
    ],
    "certificates": [
        # "my certificates, newest first" — filters on revoked and sorts on
        # issued_at, neither of which any index covered.
        IndexModel(
            [("user_id", ASCENDING), ("revoked", ASCENDING), ("issued_at", DESCENDING)],
            name="user_valid_recent",
        ),
        IndexModel(
            [("user_id", ASCENDING), ("program_id", ASCENDING)],
            unique=True,
            name="user_program_unique",
        ),
        # public verification by code
        IndexModel([("code", ASCENDING)], unique=True, name="code_unique"),
    ],
    "sakhi_conversations": [
        # Her conversation list: newest first.
        IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated"),
    ],
    "sakhi_messages": [
        # Reading a thread filters conversation_id + kind (internal turns are
        # hidden from her). 1,085 rows and growing fastest of any collection.
        IndexModel(
            [("conversation_id", ASCENDING), ("kind", ASCENDING), ("created_at", ASCENDING)],
            name="thread_visible",
        ),
        # Replaying one conversation in order — the hot path on every turn.
        IndexModel(
            [("conversation_id", ASCENDING), ("created_at", ASCENDING)],
            name="conversation_created",
        ),
        IndexModel([("user_id", ASCENDING)], name="user"),
    ],
    "org_settings": [
        # The organisation is a singleton. A unique index is what actually makes
        # that true — two racing upserts would otherwise create two rows and the
        # app would read whichever it found first.
        IndexModel([("singleton", ASCENDING)], unique=True, name="singleton_unique"),
    ],
    "org_layout_templates": [
        IndexModel([("role", ASCENDING), ("created_at", DESCENDING)], name="role_created"),
    ],
    "sakhi_memory": [
        # Read on every single turn, so it is the hottest small query she makes.
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "ai_usage": [
        # The month-to-date spend total, read before every answer.
        IndexModel([("month", ASCENDING)], name="month"),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
}


async def ensure_indexes() -> None:
    """Create every index. Safe to call on each boot; logs rather than crashes."""
    db = get_database()
    created = 0
    for collection, models in INDEXES.items():
        try:
            await db[collection].create_indexes(models)
            created += len(models)
        except Exception as exc:  # noqa: BLE001
            # A conflicting legacy index, or duplicate data blocking a unique
            # one, must not stop the app from starting.
            print(f"⚠️  Indexes for '{collection}' skipped: {exc}")
    print(f"🔎 Database indexes ensured ({created} across {len(INDEXES)} collections)")
