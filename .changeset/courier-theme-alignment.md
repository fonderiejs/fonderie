---
"@fonderie/courier": minor
---

Align the default email theme with the product design system
(`organization/ui/base.css`): near-black primary (`#171717`) for the button/ink,
a mint brand accent (`#00d294`) as a thin top rule, the accessible teal
(`#009767`) for links, the `#fafafa` canvas, the Inter font stack, tighter
display tracking, and the product's `8px`/`6px` radii. `EMAIL_THEME` gains
`brandAccent` and `link` tokens; retune it to rebrand every email at once. Pure
presentation — no template copy or API changes.
