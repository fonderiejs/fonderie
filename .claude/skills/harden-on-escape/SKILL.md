---
name: harden-on-escape
description: Use the moment you discover something you already reported as working was not — a shipped bug, a green check that proved nothing, a claim you have to retract, or a gate that passed the very thing it exists to catch. Turns each escape into a gate or a written guideline instead of a memory. Triggers on "that shipped broken", "I was wrong about", "the gate didn't catch it", "it passed locally but", "correction:", or noticing the same class of mistake twice.
---

# When something escapes, harden — do not just fix

A defect that reached further than it should have is evidence about the
*process*, not just the code. Fixing the instance and moving on guarantees the
next one of its kind escapes the same way.

The practice is cheap and has a fixed shape.

## 1. Fix the instance

Get the thing working. This is the part that feels like the whole job and is
the least durable.

## 2. Name the class

State the escape as a rule, not as an anecdote. "I grepped `dist` and it
matched `index.js`" is an anecdote. **"Presence in a bundle is not an export"**
is a class — it covers types, side-effect-only imports, and tree-shaken code
you will hit later.

If you cannot state it as a rule, you have not understood it yet.

## 3. Prefer a gate over a guideline

Ranked by how well each survives:

| | survives |
|---|---|
| a gate in CI | always |
| a test | while the file runs |
| a skill or doc | while someone reads it |
| remembering | not at all |

Write the gate if the class is mechanically checkable. `check:hook-parity`
exists because "the hook shipped to one package" was checkable; the skills
exist for the classes that are not.

**Verify the new gate fails against the state that actually shipped.** A gate
written after the fix, never run against the bug, is a guess — and you have
just demonstrated that you write checks which cannot fail.

## 4. Amend the nearest skill; do not start a new one

Skills decay by proliferation. One skill per *class*, not per incident:

- misleading green results → `verify-honestly`
- release / CI gate mechanics → `shipping-fonderie`
- backend route not reaching every client → `endpoint-to-clients`

A new skill is right only when the class has no home. If you are adding the
fourth bullet to an existing list, that is the system working.

## 5. Say what changed, plainly

The correction goes in the commit and to the person who was told otherwise —
in one or two sentences, without ceremony. "I reported X verified; it was not,
because Y. Fixed, and Z now catches it." Then continue.

## Why this is also the answer to "what is next"

The escape list *is* the priority list. Each one names a place where confidence
outran evidence, and the next defect is far likelier there than somewhere you
have never been wrong. When you are unsure what to harden, look at what most
recently fooled you.

One caution: escapes cluster around **verification**, not implementation. The
pattern is rarely "I wrote bad code" — it is "I believed a check that could not
fail." Harden the check.
