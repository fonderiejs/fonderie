---
'@fonderie/billing': major
---

Subscription dates serialize explicitly; the dead usage DTO surface is removed

`toSubscriptionDTO` passed pg `Date` objects straight into string-typed
fields — the wire was ISO only by accident of `Date.toJSON`, and any
server-side consumer doing string operations on `currentPeriodStart`,
`currentPeriodEnd`, `trialEndsAt`, or `createdAt` got a `Date` where the
type promised a string. The mapper now normalizes explicitly (nullables stay
`null`), the same convention the wallet and customers paths follow.
`GET /billing/usage/:metric` likewise sends `since` as an explicit ISO
string instead of a raw `Date`.

Removed: `IUsageRecordDTO`, `toUsageRecordDTO`, and the `IUsageRecord` row
type — declared, exported, and mapped by no route ever; a repo-wide census
found zero consumers. Their removal is what makes this a major; the wire
behavior above is unchanged for JSON consumers.
