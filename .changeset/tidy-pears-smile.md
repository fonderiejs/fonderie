---
'@fonderie/courier': minor
---

Email is branded with the app's name, not the framework's

The product name in the email shell was `EMAIL_THEME.brand` — a compile-time
constant — so every app built on Fonderie sent mail headed "Fonderie". A user who
signed up for LeadEasyGen has never heard of Fonderie, so that reads as a
different company at best and as a phishing attempt at worst, which is exactly
the wrong signal on a receipt.

The header and the in-card footer line now interpolate `{{brandName}}`. Set
`brandName` once on `ICourierConfig` and every template inherits it; a message may
still override it in its own data (a multi-tenant app may brand per workspace).
Unset falls back to `EMAIL_THEME.brand`, so an app that configures nothing still
gets "Fonderie" rather than an empty heading.

It rides the interpolation that already renders `{{subject}}` and `{{preheader}}`
over the wrapped shell, which means it is HTML-escaped with everything else — an
app name containing `&` or `<` cannot break the frame.

Also adds a "Powered by Fonderie" line below the card, on the canvas rather than
inside the frame. Deliberately NOT a hyperlink: a link would put one domain into
every message sent by every app built on Fonderie, coupling their sender
reputations, and the reader of a receipt gains nothing by clicking through.
