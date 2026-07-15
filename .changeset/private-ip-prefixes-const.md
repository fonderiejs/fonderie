---
"@fonderie/core": patch
---

Refactor the private/loopback IP check in `resolveClientIp`'s proxy-config
detection into named constants (`LOOPBACK_IPS`, `PRIVATE_IP_PREFIXES`,
`CGNAT_OR_RFC1918_172`) instead of an inline `||` chain — same behavior,
clearer intent, and now covered by tests (all RFC1918/link-local/ULA ranges
warn; public IPs don't).
