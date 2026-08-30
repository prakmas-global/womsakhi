---
status: stable
updated: 2026-08-15
tags: [module, ops]
---

# Backup and Restore

**Code:** `app/routes/backups.py`

Real backups. Create, list, download, restore — not a UI over a stub.

## Restore makes you type the backup's name

Deliberate friction. Restore is destructive and irreversible, and it sits in a
list next to "download", which is neither.

A confirm dialog is dismissed reflexively — people click through them without
reading, because most of them don't matter. Typing a specific name cannot be
done reflexively. It forces the person to look at *which* backup they selected,
which is the actual mistake being guarded against: not "restore by accident" but
"restore the wrong one".

Use the same pattern for any other irreversible bulk action.

## Backups contain identity documents

So they inherit [[ADR-011 ID documents are never publicly reachable]]. A backup
download is an access-controlled, audited action. A backup file sitting in
someone's Downloads folder is the same liability as the originals.

Related: [[Secrets]], [[Admin dashboard]]
