---
'@fonderie/customers': minor
'@fonderie/client': minor
---

Customers DTO batch: label correlation, honest relationship dates, no more silent no-ops

Six gaps from the DTO audit, fixed together. Email, phone, and address DTOs
now expose `labelId` (fetched by every query, previously dropped by the
mappers) so the label-admin surface — `listLabels`/`removeLabel` operate on
label ids — can finally be correlated with the rows using a label without
string-matching on the label value. Expanded relationship DTOs gain
`relationshipCreatedAt`: their spread `createdAt`/`updatedAt` are the
related CUSTOMER's dates, so sorting relationships by `createdAt` silently
sorted by customer signup date; the new field carries the relationship
row's own date (what the un-expanded DTO's `createdAt` always meant), and
both sides now document the semantics.

Contract honesty: `addRelationshipSchema` requires `relationship` (the
controller always 422'd without it — an optional schema let a type-correct
client walk into a guaranteed 422), and referral codes are create-time only:
`IUpdateCustomerInput` drops `referralCode`/`referredByCode` and
`updateCustomerSchema` no longer accepts them, so `updateCustomer({
referralCode })` fails validation instead of returning 200 and changing
nothing. `GET /customers/labels` responses now go through a proper
`toCustomerLabelDTO` (the one customers route that leaked raw Date rows),
and the dead `ICustomerTagDTO`/`toCustomerTagDTO`/`ICustomerTag` exports are
removed — tag routes emit plain `string[]` and always have.
