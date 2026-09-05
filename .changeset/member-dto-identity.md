---
'@fonderie/workspaces': minor
'@fonderie/client': minor
---

Carry member identity in `IMemberDTO`

`GET /workspaces/members` returned ids and roles only. `listMembers()` already
joins the users table and selects the email, name and avatar, but `toMemberDTO()`
discarded all four — so a client had nothing to display and fell back to printing
a truncated user id.

`IMemberDTO` now includes `email`, `firstName`, `lastName` and `profileImageUrl`,
so a team screen renders from that one call with no second request. Absent values
are empty strings, matching every other string field in the DTO.

Additive: existing fields and their types are unchanged.
