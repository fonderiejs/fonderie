---
'@fonderie/customers': minor
'@fonderie/client': minor
---

A customer belongs to one branch of the business (`branchId`, migration 017):
the face they deal with — the funnel that signed them up, the branch whose
name, address, taxes and language their documents carry — so a customer of
one branch never receives another branch's identity. `POST /customers` and
`PUT /customers/:id` accept `branchId` (one of the workspace's live branches,
else 422; null = the workspace's default branch); `GET /customers?branchId=`
filters. `ICustomerDTO.branchId` is '' for customers on the default branch.
Requires `@fonderie/workspaces` with branches (migration 011).
