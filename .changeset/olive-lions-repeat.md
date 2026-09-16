---
'@fonderie/courier': minor
'@fonderie/billing': patch
---

Optional template blocks, so absent fields render nothing

The renderer only did `{{var}}` substitution, so a template could not omit
anything. A receipt whose charge produced no invoice therefore rendered a
dangling "Invoice " with nothing after it, and
`<a href="">Download invoice (PDF)</a>` — a link that looks clickable and does
nothing. Both are worse than saying less.

`{{#key}}…{{/key}}` now renders its body only when `key` has a non-empty value.
Whitespace-only counts as absent, so a provider returning `""` and one returning
`"  "` behave the same. It runs before variable substitution, so values inside a
block still interpolate, and they are still HTML-escaped — a section is not an
escaping bypass.

Deliberately not a template language: one construct, no expressions. Anything
more and app authors start putting logic in templates.

Billing's receipt uses it for the invoice reference lines, which only exist when
the charge went through an invoice rather than direct to the card.
