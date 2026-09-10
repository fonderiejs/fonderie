---
"@fonderie/courier": major
---

HTML-escape interpolated values in email templates (BREAKING if your template data deliberately carried HTML). `{{var}}` values are user-influenced — e.g. `{{firstName}}` is registration-controlled — and were substituted raw into HTML email bodies, letting a user inject markup and links into platform-branded email (phishing content riding the platform's sender reputation; flagged in the first audit, unshipped until now). Values are now HTML-entity-escaped in the html part; text and subject parts are not HTML contexts and stay raw. Template markup itself is untouched — only interpolated DATA is escaped, so shipped module defaults render identically for benign values. Also: delivery webhooks now require a FRESH signed timestamp (±5 min) — without it a captured payload replayed forever, and Mailgun's scheme signs only timestamp+token (never the body), so a stale signature could even carry a forged body.
