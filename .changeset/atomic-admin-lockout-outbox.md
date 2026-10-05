---
'@fonderie/admin': patch
'@fonderie/events': patch
---

Two atomicity fixes from the database audit.

- **Admin console lockout could be bypassed by parallel guesses (security).**
  The lock was decided on a plain read, so a burst of wrong passwords (or
  second-factor codes) all saw "not locked" and were all verified before the
  first failure was counted — 15 parallel guesses, 15 verified. Attempts on one
  operator are now serialized (the row is locked for the check, the verify and
  the count): at most 5 are tried, the rest answer LOCKED.
- **An event could be stored without its deliveries.** Publishing was three
  statements (event, pending consumer rows, wake signal) with no transaction; a
  failure after the first left an event no consumer would ever process, and
  that neither pendingCount() nor deadLetters() could see. It is one statement
  now — all of it, or none.
