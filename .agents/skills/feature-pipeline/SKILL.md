---
name: feature-pipeline
description: >-
  Build a feature end-to-end using poteto's skill pipeline: plan (write to
  brain/plans/, stop for review) → execute (worktree, phases, verify, commit)
  → review → quality → reflect. Use for any delegated feature request such as
  "build feature X", "implement Y", "add Z", or when the user asks to work
  through a todo — the default flow when the user delegates instead of
  prompting step by step.
whenToUse: >-
  Use automatically for feature-building requests in this harness. If the user
  says "use the poteto pipeline", "build feature X", "implement this", or
  hands you a todo to work, engage this pipeline rather than improvising.
---

# Feature pipeline (delegation-first)

When the user delegates a feature, drive the poteto pipeline end-to-end.
The full walkthrough lives in `POTETO-SKILLS-WORKFLOW.md` (repo root); this
skill is the operational encoding with harness adaptations.

## Pipeline

1. **Plan** — load the `plan` skill and follow it:
   - Triage: trivially small (1–2 files, obvious) → just implement it; otherwise plan.
   - Ensure the project has `brain/principles.md` (create a minimal one if missing).
   - Ask scope questions with `ask_user_question` when genuinely ambiguous.
   - Explore via `subagent` (never large exploration in the main context).
   - Write `brain/plans/NN-slug/overview.md` + small phase files (1 function +
     tests per phase, ≤3 files, no code blocks — prose briefs).
   - **Stop and present the plan for review.** Do not implement until the user
     approves (or explicitly says "execute without review").
2. **Execute** — after approval, load the `execute` skill:
   - Worktree first: `git worktree add` (harness adaptation of poteto's
     `noodle worktree`) — never edit `main` unless the user opts out.
   - One change per phase; one conventional commit per change.
   - Parallelize independent phases with `subagent`; keep shared-contract
     phases sequential.
   - Run the project's full verification suite before each commit; never
     commit failing code.
   - Merge the worktree when done.
3. **Review** — load `review`: Architecture → Code Quality → Tests →
   Performance, numbered findings with tradeoffs. Fix or report them; ask the
   user before making out-of-scope changes.
4. **Quality** — load `quality` for the post-cook gate (scope discipline,
   correctness) when available.
5. **Reflect** — load `reflect` to persist lessons into the project `brain/`
   (patterns, gotchas, decisions).

## Harness adaptations (poteto's Noodle → this harness)

| Poteto/Noodle | Harness |
|---|---|
| `noodle worktree create/merge` | `git worktree add/merge` |
| `Task` tool / TaskCreate | `subagent` (exploration, parallel phases); `todo_write` for tracking |
| AskUserQuestion | `ask_user_question` |
| `noodle event emit stage_yield` | not applicable — end the turn with a summary instead |
| `brain/plans/`, `brain/principles.md` | same convention (create if missing) |

## Scope discipline

- Only change what the approved plan covers. Out-of-scope discoveries go into
  the review/quality notes, not into the implementation.
- Wrong or incomplete requirements: flag them to the user; never silently
  deviate from the plan.
