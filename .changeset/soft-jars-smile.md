---
'@fonderie/cli': patch
---

`migrate`'s connection guidance no longer censors itself

The advice shown when the database is unreachable read
`DATABASE_URL must be postgresql://user:pass@host:port/database`. CI masks
every occurrence of a secret's value anywhere in a log — including inside
text the tool printed itself — so an operator who had pasted that exact
placeholder into their `DATABASE_URL` secret saw:

```
DATABASE_URL must be ***host:port/database
```

The guidance blanked itself for precisely the person who needed it, and the
`***` made it look as though the tool was hiding something rather than
naming the mistake.

Placeholders are now shouted — `postgresql://USER:PASSWORD@HOST:5432/DATABASE`
— because caps are not pasted verbatim and so cannot collide. The message
also now names that mistake explicitly, since it is a real one people make.

Observed live: this is how the offending secret's value was identified,
without ever seeing it. A test asserts the guidance stays un-pasteable.
