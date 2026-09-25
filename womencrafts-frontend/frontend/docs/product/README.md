# Product documentation

| File | What it is |
|---|---|
| [`WomSakhi_Expanded_Product_Catalogue_V2.md`](WomSakhi_Expanded_Product_Catalogue_V2.md) | The specification. 685 capabilities across 47 areas, 45 testable scenarios, 34 sections. Revision 2.10. The source of truth — a ticket cites an ID from here |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | What exists in this repository measured against the catalogue, the seven structural gaps, and the phases with their gates |
| [`womskahi-product-master.pdf`](womskahi-product-master.pdf) | The architecture as a designed 14-page document: every module, what sits inside it, the four engines, the layers underneath, six journeys. For showing people |
| [`master-pdf/`](master-pdf/) | How the PDF is built, so it can be regenerated when the architecture changes |

## Rebuilding the PDF

Content lives in `master-pdf/build.py` (the module tree, the engines, the flows,
and which items carry the BUILT badge). Design lives in `master-pdf/style.css`,
using the same palette as `src/app/ux/tokens.css`.

```bash
python3 master-pdf/build.py                         # content -> body.html
node    master-pdf/render.mjs <doc.html> <out.pdf>   # -> A4 landscape, vector text
```

The BUILT badge marks only what has been verified running in the application.
Add one when a journey ships; do not add one for a journey that is specified.

## Conventions

- A registry ID is never renumbered. The one exception in this catalogue's
  history — `SHG-UC-001–010` becoming `SAVEGRP-UC-001–010` — is recorded in
  revision 2.5 rather than performed silently.
- A phase label is a dependency proposal. A **gate** overrides it, and a gate is
  cleared by the named owner — counsel, clinician, safeguarding, payments — not
  by an engineering flag.
- Revisions are additive. Corrections are recorded in the revision summary that
  makes them.
