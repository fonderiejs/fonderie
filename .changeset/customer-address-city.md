---
'@fonderie/customers': minor
'@fonderie/client': minor
'@fonderie/react-customers': minor
'@fonderie/react-native-customers': minor
'@fonderie/vue-customers': minor
---

Customer addresses keep a city, a door/buzzer code and coordinates.

An address picked from a places search arrives with a city and a point, and a
customer address had nowhere to put either: the city was dropped, or apps
stuffed it into `line2`. Addresses now take `city` (≤100), `accessCode`
(≤20 — the door, buzzer or gate code; the suite or apartment stays `unit`),
and `latitude` / `longitude` (decimal degrees, range-checked) on
`POST /customers/:customerId/addresses`, and return them on every address read
(`city` and `accessCode` are `''` when unset, the coordinates `null`).

Migration `018_customer_address_city` adds four nullable columns to
`fonderie_addresses` — additive; run it before this version serves (it reads
and writes them), the previous version ignores them.
Addresses written before it read back with the new fields empty. Nothing is
backfilled: an app that stored the city in `line2` can move it to `city`.
Two addresses that differ only by city are no longer duplicates.

The React, React Native and Vue customers hooks re-export the client's address
types, so `useCustomerAddresses().addAddress` takes the new fields as typed
input and the returned addresses carry them.
