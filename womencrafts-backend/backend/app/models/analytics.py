"""
Deliberately empty.

This file held seven models backing the `analytics_*` collections: a snapshot of
visitor counts, page views, bounce rates, device shares and referring domains,
all written by a seeder and read straight back out.

None of it was measured. WomSakhi records no page views and has no tracker, so
those numbers described a website that does not exist — 48,592 visitors against
46 real members. `routes/analytics.py` now counts members, bookings and
enrollments inside the window the selector asks for, so there is nothing left
for these models to store.

The `analytics_*` collections are still in MongoDB and are no longer read or
written. They are left in place rather than dropped: deleting data is not
something to do quietly on the way past. Drop them when you are ready to.

See [[Empty is not the same as broken]] for why the fabricated version was worse
than showing nothing.
"""
