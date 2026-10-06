---
'@fonderie/workspaces': minor
'@fonderie/client': minor
---

The business profile carries what a field-service business prints: `industry` (the app's own sector key), `address.accessCode` (buzzer / door code; the unit stays `line2`), a `rate` (percent) on each tax registration — which may now be saved before its number arrives — and `settings.documentPrefixes` (`{ invoice: 'ACME', job: 'ACME-JOB' }`). All optional and additive; migration 009 adds the nullable `industry` column. Bad values are refused with a 422 naming the field (`industry:`, `address.accessCode:`, `taxRegistrations.0.rate:`, `documentPrefixes.invoice:`).
