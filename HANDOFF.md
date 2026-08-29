# HANDOFF.md — continuation brief (next session)

**Read this first in a new context window.** Everything needed to continue
lives here and in the docs this repo links to. Written 2026-08-28 (end of
day), commit `0247906` is the last pushed state; `origin/main` is in sync.

---

## 1. What this project is

`ai-harness` = the deployment config for **DeepSeek Harness (dsh)** on two
machines that swap weekly, centered on integrating **Kimi Code**:

- **Kimi Code CLI as a subagent** (`subagent_kimi` tool) via the harness's ACP
  bridge.
- **Kimi K3 (1M context) as the main agent model** using the user's **Kimi
  monthly subscription** (no pay-as-you-go API key) — via an independent
  OAuth device-code credential.
- **Poteto's skills** vendored in-repo for delegation-first feature building.
- A **two-machine parity** workflow with idempotent scripts.

## 2. Repo map (all committed & pushed)

| Path | What it is |
|---|---|
| `scripts/setup-kimi.mjs` | Idempotent machine setup: ACP bridge install (from `vendor/`), profile patch, `kimi` preset, **settings.yaml** (default model `kimi-coding/k3`). 6 steps, self-verifying. |
| `scripts/kimi-login.mjs` | Interactive device-code login → independent subscription credential in the harness store. **The recommended auth path.** |
| `scripts/bridge-kimi-token.mjs` | Fallback: imports the CLI's token (shared lineage — fragile, warns). `--verify --model <id>` tests through pi-ai. |
| `scripts/install-skills.mjs` | Copies `.agents/skills/` → `~/.dsh/skills/` (user root). |
| `scripts/import-skills.mjs` | Imports third-party SKILL.md collections (used for poteto). |
| `scripts/lib.mjs` | Shared helpers (dsh discovery, js-yaml/pi-ai resolution from the harness install). |
| `.agents/skills/` | **65 vendored skills**: poteto's noodle collection (32) + poteto's pstack (34: 21 principles + workflow skills + poteto-mode, from `poteto/plugins#pstack`) + `how` + `verify-atlas` + `feature-pipeline` + `kimi-integration` + `machine-parity`. |
| `vendor/` | Pinned tarballs: `@deepseek-ai/dsh-subagent-acp@0.1.1-rc.2`, `@agentclientprotocol/sdk@0.25.1` (SHA-256s in git history). |
| `README.md` | Overview + quick start. |
| `SETUP.md` | Per-machine setup; §4 subscription (4a `kimi-login` recommended); troubleshooting. |
| `TWO-COMPUTER-WORKFLOW.md` | Weekly swap, config-source table ("where does the harness know?"), known-good snapshot, parity checks. |
| `ORCHESTRATION.md` | Skills + agent orchestration (subagents, workflows, ralph). |
| `POTETO-SKILLS-WORKFLOW.md` | **The feature-building how-to with poteto's skills** (delegation-first pipeline). |
| `KIMI-INTEGRATION.md` | Original deep-dive + manual steps + patch-syntax gotchas. |

## 3. Current live state (this machine, verified)

- dsh `0.1.1-rc.2`, web profile at `~/.dsh/profiles/web`; harness GUI running
  on the host at `127.0.0.1:3080` (outside the agent sandbox).
- `cordis.patch.yml`: `subagent-kimi` provider row (command
  `/home/phage/.kimi-code/bin/kimi`, args `[acp]`, `permission: allow`,
  loader `- insert:` form) + `agent-presets.default: kimi`.
- `~/.dsh/.agent-presets/kimi/agent.cordis.yml`: standard preset + the
  `subagent_kimi` tool row.
- `~/.dsh/settings.yaml`: `agent-default-model: {provider: kimi-coding,
  model: k3}`; `llm-pi-ai.providers.kimi-coding: {}`.
- `~/.dsh/.credentials.yaml`: record `llm-pi-ai/kimi-coding` (kind grant,
  type oauth) — **independent credential**, auto-refreshes; verified working
  through the harness's pi-ai stack (real k3 request → "OK").
- `~/.dsh/skills/`: 65 skills installed (user root).
- Kimi CLI `0.38.0` installed at `~/.kimi-code/bin/kimi`; **CLI login is
  DEAD** (see §5).

## 4. Pending / next steps (in priority order)

1. **[User action] Restart the harness GUI** (`dsh web`) — then in a NEW
   session confirm: tool catalog has `subagent_kimi`, and the model is
   `kimi-coding / k3`. This is the **only unverified end-to-end step**
   (the earlier k3 session's "OAuth refresh failed" was fixed by the
   independent credential; a restart + new session is the proof).
2. **Set up machine B** (the other computer): `git clone` (or pull) →
   `npm run setup` → `npm run kimi-login` → `npm run skills:install` →
   restart → run the parity checks in `TWO-COMPUTER-WORKFLOW.md`.
3. **Try delegation-first feature building for real**: pick a feature in one
   of the user's apps (`ls-trader`, `kadenx-trading`, `tradedeck-cpp`,
   `kadenx-voice`) and run the pipeline — say "build feature X" (the
   `feature-pipeline` skill auto-engages: plan → review → execute → review).
   One-time per project: `mkdir -p brain/plans && echo "# Principles" >
   brain/principles.md`.
4. **Re-auth the CLI** (`kimi login` in a terminal, user action) — needed for
   the `subagent_kimi` child and terminal use; independent of the harness
   credential.

## 5. Known issues / caveats

- **CLI login dead**: the shared-token-lineage incident (harness + CLI
  sharing one refresh token) burned both copies. Fix = `kimi login` (CLI) and
  `npm run kimi-login` (harness, already done). Harness credential is now
  independent — this cannot recur via the recommended path.
- **Settings → Models shows an API-key field for `kimi-coding`** — leave it
  empty; the bridged/独立 credential is what's used.
- **Patch syntax**: new rows in `cordis.patch.yml` must use `- insert:`
  blocks (bare `- id:` rows are overrides and silently don't mount).
- **Poteto skills assume Noodle conventions** (`brain/`, `noodle worktree`,
  stage events). In this harness the agent adapts: `git worktree`,
  `subagent`, `ask_user_question`, `todo_write`. See
  `POTETO-SKILLS-WORKFLOW.md` § 6.
- **`poteto-mode` is user-invocable only** (`disable-model-invocation`).
- **Sandbox facts for the agent** (next session): bash runs in a bubblewrap
  sandbox — `/tmp` is wiped per call, `~/.dsh` is read-only **without**
  `sandbox_permissions: danger-full-access` escalation, host processes (the
  GUI) are not visible, and `git push` needs
  `GIT_SSH_COMMAND="ssh -F /dev/null -o StrictHostKeyChecking=accept-new -i $HOME/.ssh/id_ed25519"`.

## 6. Cheat sheet (commands)

```bash
npm run setup            # full machine config (bridge, patch, preset, settings) — idempotent
npm run setup:dry        # preview
npm run kimi-login       # independent subscription credential (device-code) — per machine
npm run bridge[:verify]  # fallback: import CLI token (shared lineage)
npm run skills:install   # repo skills → ~/.dsh/skills
npm run skills:import:poteto   # refresh poteto set from upstream
dsh --profile web --dump-config | grep -A6 subagent-kimi   # parity check
```

## 7. Open offers (not yet taken)

- Cursor `.mdc` → SKILL.md converter in `import-skills.mjs`.
- Bootstrap `brain/principles.md` for the user's projects from poteto's
  `principle-*` playbooks.
- A real `plan`-skill run on a chosen feature (pending user picking one).

---

*Next session: read `POTETO-SKILLS-WORKFLOW.md` and `TWO-COMPUTER-WORKFLOW.md`
before acting on §4. Ask the user which pending item to start with.*
