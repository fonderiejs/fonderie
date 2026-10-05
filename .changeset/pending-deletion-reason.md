---
'@fonderie/client': minor
---

`localizeApiError` says what an archived account means, in the reader's
language: after sign-in, "This account is scheduled for deletion on 3 November
2026. You can still keep it." (`ACCOUNT_PENDING_DELETION` with `details.deleteOn`),
and at sign-up, where no date is sent, a short sentence pointing to signing in.
Until now these fell back to the generic "You don't have permission".

Two general improvements: a detail that is an ISO instant is shown as a date in
the reader's language (never a raw timestamp), and a reason may have a
`'<REASON>:short'` sentence used when its details are absent.
