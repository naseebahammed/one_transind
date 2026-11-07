---
name: explain-code
description: Use when the user inherits legacy code, pastes a complex snippet from online, or asks "what does this do / how does this work / is this safe to use" about code they did not write. Produces a fast, plain-language explanation with a mental model, a walkthrough, the gotchas, and a verdict on whether it is safe to adopt.
---

# Explain Code

Goal: the reader understands the code well enough to change it or decide to use it, in one read. The reader may not be a full-time developer, so use plain language and define any jargon in a few words the first time.

## 1. Identify the input

- **A file or folder in this repo (legacy code):** read it, then grep for its callers and what it imports. Code only makes sense next to who uses it.
- **A snippet pasted from online:** treat it as untrusted. Note the language, framework and version it assumes, and whether those match this project (see `package.json`).
- If the target is unclear or huge, ask which part matters most before reading everything.

## 2. Read in this order

1. Inputs and outputs: what goes in, what comes out, what it changes (database, files, network, global state).
2. The happy path: the main line of execution, ignoring error branches.
3. The edge cases: error handling, empty/null inputs, loops that can end early.
4. Hidden behaviour: side effects, mutation of arguments, async timing, regex, bit tricks, clever one-liners.

Run it if that is cheap and safe (a pure function, a test, `node -e`). Never run code that writes to the database: `.env.local` may point at the live DB.

## 3. Write the explanation

Use exactly these sections, short:

**In one sentence** — what it does and why someone would want it.

**Mental model** — an analogy or a 3–5 step flow ("takes X → groups by Y → sums Z → returns a map"). Add a small diagram only if the flow branches.

**Walkthrough** — go block by block, quoting line references as `file:line`. For each block: what it does, and *why* it is written that way if not obvious. Rewrite any dense expression into a plain equivalent, e.g.:

```ts
// original
const x = arr.reduce((a, b) => ({ ...a, [b.id]: b }), {});
// same thing, plainly
const x = {}; for (const b of arr) x[b.id] = b;
```

**Gotchas** — bugs, surprising behaviour, performance traps (e.g. N+1 queries, quadratic loops), security issues (SQL built from strings, unchecked input, secrets in code), and assumptions that may not hold here.

**Verdict** (for online snippets or before changing legacy code) — one of:
- *Safe to use as is*
- *Use with changes* — list them
- *Do not use* — say why and suggest what to do instead

## Rules

- Explain, do not refactor. Only change code if the user asks.
- Say what you are unsure about instead of guessing; point to the line that would settle it.
- For this project, flag anything that breaks the CLAUDE.md rules: writes to ERP views, schema changes outside `lib/schema.ts` migrations, the dollar symbol, or costs stored as positive numbers.
- Do not paste the whole file back; quote only the lines you explain.
