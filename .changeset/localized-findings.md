---
'@fonderie/core': minor
'@fonderie/admin': minor
'@fonderie/client': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/auth': minor
'@fonderie/billing': minor
'@fonderie/config': minor
'@fonderie/courier': minor
'@fonderie/events': minor
---

The admin console now shows every server message in the operator's language:
readiness problems, doctor findings and "skipped" reasons.

Until now the console chrome was translated, but what the bricks reported was
English prose. A French-speaking operator reading about a missing DMARC record
or a price mismatch got English. Those findings are the part they most need to
understand.

Each finding now carries a stable `reason` (UPPER_SNAKE), its `domain` (the brick
that emitted it) and `metadata` (the raw values). This is the AIP-193 ErrorInfo
shape the API errors already use. The English `message` stays as the fallback.

- **core** — `IFinding`. `IReadinessProblem` gains `reason`, `domain` and
  `metadata`. `IAdminCheckReport.findings` accepts `string | IFinding`, and so
  does `skipped`. Plain strings still work.
- **auth, billing, config, courier, events** — every readiness problem, check
  finding and skip reason now carries a reason: 54 in all.
  - Enum-like values are UPPER_SNAKE, for example the subscription-drift
    `impact`, so no English leaks through a parameter.
  - billing adds `priceFindings`, `webhookFindings` and
    `subscriptionDriftFindings`. courier adds `senderDnsFindings`.
  - The `describe*` functions still return the English lines.
- **admin** — the doctor results add `details` (the findings in order, each with
  its own severity) and `skippedDetail`, next to the unchanged English
  `findings` and `skipped`.
  - Attention items carry reason, domain and metadata. Each one also has its
    own severity, so an SPF suggestion is no longer shown as an error.
  - New `migrationsCheck(store, sets)` gives apps a translated
    pending-migrations doctor check.
- **client** — `localizeReason(item, locale)`, plus French and Spanish sentences
  for every reason. An unknown reason (a newer brick or an app's own check)
  falls back to the English message.
- **react-admin-screens, vue-admin-screens** — the Attention, Doctor, Modules
  and Environment pages render the translated sentence. They colour each
  finding by its own severity.

CI adds `check:reasons`, which checks two things:

- every emitted domain + reason has an English sentence;
- every sentence is still emitted.
