---
'@fonderie/auth': minor
'@fonderie/geo': minor
'@fonderie/client': minor
'@fonderie/react-auth': minor
'@fonderie/vue-auth': minor
'@fonderie/react-native-auth': minor
'@fonderie/react-admin-screens': patch
'@fonderie/vue-admin-screens': patch
---

Auth events can say where they came from. `IAuthConfig.location` is an
optional resolver `({ ip, headers }) => IRequestLocation | null`, called at
most once per request. Its result is stored on every login-attempt row, on a
new `registration` row written at sign-up, and on each new session (nullable
`location` JSONB columns — migrations 018 and 019, run your migrations), and
returned as `location` on login-history events and active sessions. Absent
resolver ⇒ `location: null`, behaviour unchanged apart from the new
`registration` rows in login history.

Registration is recorded because with verification not enforced the account
is live from that request: it is the first record of where the user came from.

Auth imports no geo code: on Vercel/Cloudflare pass
`({ headers }) => geoFromHeaders(headers, { trust })` from `@fonderie/geo`; a
self-hosted table or an IP-intelligence API fits the same contract and may add
ISP/ASN/proxy/hosting. Output is treated as untrusted: type-checked and
bounded, coordinates rounded to ~1 km, re-sanitized on read;
a resolver that throws or exceeds 1.5 s leaves the row without a location.

Client: `IRequestLocationDTO`, `location` on `ILoginEventDTO` and
`ISessionDTO`, and `describeLocation(loc, countryName?)` ("Mountain View, CA, US");
the auth hook packages re-export the type. The admin console shows location
next to the IP for live sessions and recent sign-ins, with a proxy/VPN or
hosting flag when known.

Postal / ZIP code is kept when the resolver knows it (`postalCode`), and
`@fonderie/geo`'s `geoFromHeaders` now reads it from Vercel's
`x-vercel-ip-postal-code` and Cloudflare's `cf-postal-code`. It is approximate
for an IP, so `describeLocation` leaves it out of the one-line display.
