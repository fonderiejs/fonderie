---
name: verify-honestly
description: Use whenever you are about to claim something works, is fixed, is healthy, is clean, or has shipped — after writing a test, running a typecheck/lint/build, reading a metric or health endpoint, polling for a deploy or published version, querying a database to confirm state, or inferring a value you cannot see. Triggers on phrases like "verified", "confirmed", "all green", "tests pass", "it works now", "production is healthy", "nothing is stuck", before reporting them. Also use before trusting an absence (no errors, zero pending, empty result) as evidence of success.
---

# Verify honestly

A check that cannot fail is not a check. Most bad claims are not lies — they
come from a verification that was structurally incapable of returning "no".

The rule: **before believing a green result, ask what red would have looked
like.** If you cannot describe the failing case concretely, you have not
verified anything yet.

## The seven failure modes

Each of these shipped a false "verified" in real work. They recur because each
one *feels* like evidence.

### 1. The test that passes against the broken code

Writing a test after a fix proves nothing until you have seen it fail without
it.

```
git stash        # or re-introduce the bug
npm test         # MUST fail, with the message you expect
git stash pop
npm test         # now green means something
```

If it passes both ways, the test is decoration. This is not optional for a
regression test — the whole claim is "this would have caught it".

Watch for assertions that are satisfied either way: asserting that detached
work *eventually* completed passes whether or not it was awaited, because the
detached version completes too — just later. Assert the discriminating
property (was the caller still pending?), not the shared one.

### 2. The unconditional success message

```
npx tsc --noEmit && echo "typecheck OK"     # fine
npx tsc --noEmit | head -3; echo "OK"       # ALWAYS prints OK
```

Worse: a command that aborts early prints one unrelated error and exits, and
the eye reads "only one warning". Check the exit code, or check that the
output is *empty*, not that it is *short*.

### 3. The query that matches itself

A `pg_stat_activity` lookup whose SQL contains the string it searches for will
always find at least one row: its own. Same for `ps | grep`, log scans that
match the line they just wrote, and any tool inspecting a system it is part of.

Exclude yourself explicitly (`pid <> pg_backend_pid()`), or make the pattern
unmatchable by the probe itself.

### 4. "It changed" instead of "it changed to the expected value"

```
[ "$v" != "$old" ] && done    # accepts ANY change, including a wrong one
[ "$v"  = "$want" ] && done   # correct
```

Polling for a deploy, a published version, a migration, or a status field:
name the value you expect. A leftover from an earlier run satisfies "changed".

### 5. The metric that measures the wrong thing

Before trusting a number, ask which table or source it actually comes from and
whether that source *observes the failure you care about*. A queue that marks
work "processed" when the handler returns cannot tell you whether the side
effect succeeded, if the handler swallows errors. The dashboard will be green
while the thing fails.

Trace the metric to the write that records the outcome. If no write records it,
the metric cannot report it.

### 6. The ambiguous absence

`0 pending`, `null lastEvent`, `no errors in the log`, `empty result` — each
has at least two causes, usually "healthy" and "never ran". They are opposite
conclusions from identical evidence.

Report absences only alongside the number that disambiguates them: a total, a
count of the population, a last-success timestamp, an age. If you cannot
disambiguate, say the reading is ambiguous rather than picking the happy
branch.

### 7. The inferred value

A masked length, a truncated hash, a matching shape — none of these identify a
value. Two different 35-character strings are both 35 characters. Say what you
observed ("the length matches"), never what you concluded from it.

## Before saying "verified"

- [ ] I have seen this check fail, or I can state exactly what failure looks like
- [ ] Green came from an exit code or empty output, not from a chained `echo`
- [ ] The probe cannot match itself
- [ ] I compared against the expected value, not merely against the old one
- [ ] The metric is written by the step that can fail
- [ ] Every absence I am reporting is disambiguated by a second number
- [ ] I am reporting observations, not inferences — and labelling which is which

## Say what you actually know

When verification is partial, the honest phrasings are short:

- "Typecheck and tests pass; I could not reproduce the original failure locally,
  so this rests on reasoning plus CI."
- "`pending: 0` — but that is also what a queue nobody published to looks like."
- "The length matches; I have not seen the value."

These cost one sentence and are worth more than a confident "verified" that
turns out to be false. A correction later costs far more than a caveat now —
and a false green sends someone else looking in the wrong place.
