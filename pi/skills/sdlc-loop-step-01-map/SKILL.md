---
name: sdlc-loop-step-01-map
description: Step 1 of the SDLC loop. Build the feature map, add a new feature entry with its proof predicate, or update an existing entry when the feature changes. Use when starting any feature work or when the map is missing.
---

# Step 1: map

The map is the contract. Everything later reads from it. It lives in the repo
at `resource/features/` (ls-trader) or wherever the repo keeps it: one index
`README.md` plus one file per feature.

## When this step runs

- **No map yet.** Build it. Top 3-5 load-bearing features first. Find them
  from menus, commands, modes, and docs, not from code structure.
- **New feature.** Add its entry before writing code. The proof predicate is
  the spec.
- **Changed feature.** Update the entry's proof predicate to the intended new
  behavior. Record the old predicate as the baseline.
- **Removed feature.** Delete the entry.

## Per-feature file format

Title, one paragraph on the user-visible behavior, then exactly these H2
sections in order:

1. `Sub-features` — short IDs, one line each.
2. `How to get to it (user POV)` — every user entry point.
3. `Driving it with <harness>` — `Preconditions:` then labeled bullets pairing
   each user action with the exact command and the observable result.
4. `Gotchas` — traps that waste or invalidate a run.
5. `Anchors` — the code that proves the feature exists, one bullet per anchor
   as `- <path>: <needle>`. The audit greps each path for its needle.

Keep implementation detail out of the first four sections. Name only user
paths, stable handles, required state, commands, and observable proof. The
Anchors section is the one place code detail belongs.

## The index

`README.md` holds baseline preconditions, driving conventions, proof and skip
reporting, and the feature list linking every file.

## Rules

- The proof predicate must name evidence: a row, a line, a visible state.
  Never "works".
- Pick the surface per evidence item. Logic evidence goes to the CLI loop.
  Rendered state goes to the UI loop. Say which in the entry.
- Record the feature ID and entry point with every verification artifact.
