# POTETO-SKILLS-WORKFLOW.md — building features with poteto's skills (delegation-first)

How to use poteto's skill set to build features in this harness — written for
the workflow where **you delegate feature work to the agent and the agent
drives the pipeline**, instead of you prompting step by step.

The loaded set (vendored in `.agents/skills/`, installed in `~/.dsh/skills/`):

- **noodle collection (32)** — the stage machinery: `plan`, `execute`,
  `review`, `quality`, `testing`, `refine`, `todo`, `brain`, `reflect`, …
- **pstack (34, from `poteto/plugins#pstack`)** — the guardrails:
  **21 engineering principles** (`principle-prove-it-works`,
  `principle-encode-lessons-in-structure`, …), the workflow skills
  (`architect`, `arena`, `interrogate`, `tdd`, `why`, `show-me-your-work`,
  `setup-pstack`), and **`poteto-mode`** (the style + playbook routing layer).
- **poteto/how, verify-atlas** — architecture explainer, verification-skill
  example.
- **ours**: `feature-pipeline` (delegation-first default), `kimi-integration`,
  `machine-parity`.

**What the full pstack changes:** before, the pipeline (plan → execute →
review) ran on good general practice. Now the plans are **principle-governed**
(the `plan` skill must cite `brain/principles/`), sessions can run in
**poteto-mode** (style + playbook routing: features, bug fixes, refactors, PR
shipping), and **`show-me-your-work` / `principle-prove-it-works`** make
evidence the deliverable, not claims.

---

## 1. The mental model

A skill is **an instruction file the agent loads on demand**. When your
request matches a skill's description, the agent calls the `skill` tool, the
instructions are injected into its context, and it **follows them instead of
improvising**. You trigger skills with ordinary language:

> "Plan this feature: …" → loads `plan` · "Execute the plan" → `execute` · "Review this" → `review`

Poteto's methodology is a **pipeline**:

```
poteto-mode (style) → plan → refine → execute → review → testing → quality → reflect
```

## 2. One-time setup per project

Poteto's skills assume conventions; set them up once per project:

1. **`brain/` directory** — the `plan` skill *requires* reading
   `brain/principles.md` and writes plans to `brain/plans/`:
   ```bash
   mkdir -p brain/plans brain/principles && echo "# Principles" > brain/principles.md
   ```
   The plan skill follows `[[wikilink]]s` from `brain/principles.md` into
   `brain/principles/<name>.md` files. Seed those from poteto's **21 principle
   skills** (now vendored in `.agents/skills/principle-*`): each
   `principle-*/SKILL.md` body becomes the corresponding
   `brain/principles/<name>.md`, and `brain/principles.md` lists them as
   wikilinks. (A one-shot bootstrap: copy each principle skill's body into the
   project's `brain/principles/`.) Without this, the plan skill's Step 1 has
   no principles to cite and the plans lose their design guardrails.
2. **Worktrees** — `execute` refuses to edit `main`. The harness adapts
   poteto's `noodle worktree` to plain `git worktree`. Safe default: let the
   agent use worktrees for anything beyond a one-file fix.
3. **poteto-mode** (optional style layer) — say *"use poteto-mode"* (it is
   user-invocable only). It applies poteto's agent style and playbooks
   (feature, bug-fix, refactoring, investigation, …) for the session.
4. **setup-pstack** (optional) — poteto's pstack routes work to *different
   models per role* (feature model, explorer model, critic models). In this
   harness the route is the session's model (`kimi-coding/k3` by default);
   the `setup-pstack` skill records the intended role→model mapping as an
   always-applied rule. Run it once if you want explicit model routing.

## 3. The feature flow, step by step

Example feature: *"add a GET /health endpoint to the bridge"* (Rust, ls-trader).

### Step 1 — Plan (deliverable: a plan, no code)

Say: **"Plan this feature: …"**

The agent loads `plan` and follows it literally:

1. **Triage** — trivially small (1–2 files, obvious) → skip planning; otherwise proceed. New API surface / 3+ files / architecture → plan.
2. **Reads `brain/principles.md`** — plan decisions cite principles by name.
3. **Asks scope questions** (`ask_user_question`): in/out of scope, what "done" means.
4. **Spawns subagents to explore** the codebase (never explore in the main context) — they map routes, server setup, patterns, tests.
5. **Checks domain skills** — matches installed skills to the task; flags gaps.
6. **Writes the plan** to `brain/plans/NN-slug/overview.md` + **8–10 small phase files** (each phase = 1 function/type + tests, ≤3 files).
7. **Self-checks**: principles cited, phases sized, **no code blocks in phases** ("a brief to a senior engineer, not a diff").
8. **Presents the plan and STOPS.** You review the plan files.

### Step 2 — Execute (deliverable: committed, verified code)

Say: **"Execute the plan"** (or "execute phase 3").

The agent loads `execute` and:

1. **Worktree first**: `git worktree add` a branch — never `main`.
2. **Decomposes** into per-phase changes; one conventional commit each.
3. **Implements**; parallelizes independent phases via subagents (team
   execution); keeps shared-contract phases sequential.
4. **Verifies** the full suite before every commit — never commit failing code.
5. **Commits** conventionally (`feat(bridge): add /health endpoint`).
6. **Merges** the worktree.

### Step 3 — Review & close (deliverable: findings, then merge)

- **"Review the changes"** → `review`: Architecture → Code Quality → Tests →
  Performance, numbered findings with tradeoffs.
- **`quality`** — post-cook gate: scope discipline, correctness.
- **`reflect`** — persist lessons to `brain/` (patterns, gotchas).
- **`commit`** — clean messages; **`todo`/`refine`** — backlog management.

## 4. Cheat sheet (what you type)

| You say | Skill | What happens |
|---|---|---|
| "Plan this feature: …" | `plan` | Exploration → plan in `brain/plans/`, stops for review |
| "Execute the plan" / "build this" | `execute` | Worktree → phases → verify → commits → merge |
| "Review this / my changes" | `review` | Numbered findings (architecture → tests → perf) |
| "Write a test for …" | `testing` | TDD workflow |
| "Commit this" | `commit` | Conventional commit message |
| "Add a todo / what's on the backlog" | `todo` / `refine` | Backlog management |
| "Reflect / remember this" | `reflect` | Lessons → `brain/` |
| "Use poteto-mode" | `poteto-mode` (user-invoked) | Poteto style + playbooks for the session |

## 5. Delegation-first mode (recommended)

To move away from step-by-step prompting, delegate the *outcome* and let the
agent drive the pipeline. Two ways:

1. **One-liner delegation:**
   > "Build feature X in ls-trader. Use the poteto pipeline."
   The agent loads the `feature-pipeline` skill (below) and runs
   plan → (your review) → execute → review automatically, pausing only for
   your approval of the plan and the merge.

2. **Backlog-driven:** keep `brain/todos.md`; say *"work the next todo"* and
   the agent scopes it (via the `todo`/`refine` skills), plans, executes, and
   reports.

### The `feature-pipeline` skill (shipped in this repo)

`.agents/skills/feature-pipeline/SKILL.md` encodes the default flow: on any
feature request, engage the poteto pipeline end-to-end with harness
adaptations (git worktrees, `subagent` for exploration/parallel phases,
`ask_user_question` for scope, conventional commits). Loading it makes the
pipeline automatic — that is the delegation-first enabler.

## 6. Honest caveats

- Poteto's skills were written for their **Noodle orchestration tool**
  (`noodle worktree`, `brain/`, stage events). In this harness the agent
  **adapts the methodology with harness-native tools** (`git worktree`,
  `todo_write`, `subagent`, `ask_user_question`). The discipline transfers
  fully; noodle-specific commands do not exist here.
- **Worktrees matter**: `execute` refuses `main` by default. If you prefer no
  worktrees in a session, say so explicitly.
- Skills are discovered **per workspace**: this repo's sessions see them
  automatically; other projects use `~/.dsh/skills/` (installed per machine
  via `npm run skills:install`).
- `plan` writes to the project's `brain/` — make sure the project has one
  (Section 2); otherwise the agent will create a minimal one.
