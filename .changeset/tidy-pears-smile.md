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
inside the frame, linking to the project site.

The link is what makes the attribution work: "Fonderie" is a common French noun,
so a curious reader who searches it finds metal foundries rather than this
project. Linking the brand word to its own domain is also the shape spam filters
expect — the deceptive-mismatch signal is about text that impersonates a
different destination, not a name pointing at its own site. The cost to weigh is
that link-domain reputation is a spam signal, so one domain in every message from
every app built on Fonderie couples their sender reputations; revisit if third
parties ship on Fonderie in volume.
