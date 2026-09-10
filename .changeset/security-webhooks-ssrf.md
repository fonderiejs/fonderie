---
"@fonderie/webhooks": minor
---

Guard outbound webhook delivery against SSRF. Webhook URLs are attacker-controlled, so both endpoint registration and every delivery now reject non-`http(s)` schemes and any host that resolves to a non-public address (loopback, RFC1918, CGNAT, link-local incl. the cloud metadata IP `169.254.169.254`, IPv6 ULA/link-local, and reserved ranges). The check runs again at delivery time — not just registration — because DNS can change, and deliveries are sent with `redirect: 'manual'` so a public host cannot 302 the request into an internal one. Adds `assertPublicHttpUrl`, `isBlockedAddress`, and `SsrfError` to the public API for pre-validation.
