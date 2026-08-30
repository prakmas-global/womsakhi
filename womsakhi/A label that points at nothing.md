---
status: stable
updated: 2026-08-17
tags: [idea, accessibility]
---

# A label that points at nothing

The worst accessibility bugs look correct.

`Input` rendered its label like this:

```tsx
<FieldLabel htmlFor={props.id}>{label}</FieldLabel>
```

Of **112 usages across the app, not one passed an `id`**. So `htmlFor` was
`undefined` on every single field. The label appeared, in the right place, in
the right type — and was associated with nothing. A screen reader reached the
input and said *"edit text, blank"*.

Nothing on screen is wrong. There is no visual symptom to notice, no console
warning, no failing render. It survived because the only way to see it is to
either read the HTML or listen to the page.

## The fix is to remove the chance to forget

```tsx
const autoId = useId();
const id = props.id ?? autoId;
```

Not "remember to pass an id" — an id that cannot be forgotten. The same move as
[[Cannot trap yourself]]: when correctness depends on every caller remembering,
it is not a convention, it is a pending bug with 112 chances to fire.

## Where a label physically cannot work

`Select` is a `<button>`, not a `<select>`. `htmlFor` only binds to form
controls, so a `<label>` next to it is decoration no matter what you do. The
trigger announced its *value* ("Active") with no hint of which field that value
belonged to.

`aria-labelledby` pointing at both the label and the value gives the pair:
*"Status, Active"*.

## Required, not optional

Three components now take `label: string` as a **required** prop —
`InputField`, `Toggle`, and the settings fields. Not because a label is always
wanted, but because these render controls made of empty spans:

> A toggle is a track and a knob. Two `<span>`s. It carries no text of its own
> at all.

Rendered 41 times on one settings screen, that is 41 controls announcing
*"switch, on"* with nothing to say **which** setting is on. In a matrix — four
switches per row, the row name in a different table cell — they are worse than
useless.

Making the prop required means the next one cannot be added without a name.
TypeScript now enforces what a review would have to catch every time.


## The same fault, one level up: tables

**124 `<th>` elements, not one with a `scope`.**

`scope` says whether a header labels a column or a row. Without it, a screen
reader announcing a cell gives you the value and nothing else — so a table of
8 columns × 15 rows is 120 bare values in sequence, with no way to tell which
column any of them came from.

A sighted user gets that mapping for free, from the layout. Everyone else gets
it only if the markup says so.

The shape of the bug is identical to the label one: the header text is right
there, visible, correct — and not *connected* to anything. Looking correct and
being correct are different properties, and only one of them is visible.

All 124 are column headers. That is checked, not assumed: zero `<th>` appear
inside a `<tbody>`, so there are no row headers to get wrong.

Related: [[Where am I]], [[The check that runs in a second]], [[Cannot trap yourself]]
