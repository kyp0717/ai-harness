# ai-harness

DeepSeek Harness (dsh) deployment configuration — the Kimi Code integration,
the operator docs for keeping **two computers in identical configuration**
(you swap between them weekly), plus starter **skills** and **agent
orchestration** patterns.

## What's in this repo

| Path | Purpose |
|---|---|
| `scripts/setup-kimi.mjs` | One-command, **idempotent** setup: installs the Kimi Code ACP bridge into the dsh `web` profile, patches the profile, creates the `kimi` agent preset. Run it on every machine, every time. |
| `scripts/kimi-login.mjs` | **Interactive** device-code login: signs the harness into your Kimi subscription with its **own independent** credential (recommended over bridging). |
| `scripts/bridge-kimi-token.mjs` | **Idempotent** bridge: imports your Kimi Code CLI's *subscription* OAuth tokens into the harness credential store (shared lineage — prefer `kimi-login`). |
| `scripts/install-skills.mjs` | Copies repo skills (`.agents/skills/`) into `~/.dsh/skills/` so they work in every workspace. |
| `scripts/import-skills.mjs` | Imports third-party SKILL.md collections (poteto/noodle, poteto/how, etc.) into the user root, idempotently. |
| `.agents/skills/` | Starter skills: `kimi-integration`, `machine-parity` (auto-discovered in this repo's sessions). |
| `vendor/` | Pinned tarballs (with SHA-256 in git history) for offline install — no npm registry needed on the target machine. |
| `SETUP.md` | Step-by-step for setting up **one** machine from scratch. |
| `TWO-COMPUTER-WORKFLOW.md` | The weekly-swap procedure: what's synced, what's per-machine, the checklist, known-good snapshot. |
| `ORCHESTRATION.md` | Building skills + orchestrating agents (subagents, kimi subagent, workflows, ralph). |
| `KIMI-INTEGRATION.md` | The original deep-dive: how the integration works, the manual steps, the patch-syntax gotchas, troubleshooting. |

## Quick start (one machine)

```bash
# 0. Prerequisites on the machine
node --version          # >= 18
kimi --version          # Kimi Code CLI installed (kimi login optional for the CLI)
dsh web                 # start the harness ONCE so the profile initializes, then stop it

# 1. Get this repo
git clone git@github.com:kyp0717/ai-harness.git && cd ai-harness

# 2. Apply the Kimi integration (idempotent — safe to re-run)
npm run setup

# 3. Main model on your Kimi SUBSCRIPTION (no API key) — independent credential
npm run kimi-login      # prints URL + code; complete in the browser

# 4. Optional: make the repo skills available in every workspace
npm run skills:install

# 5. Restart the harness GUI and verify (SETUP.md § Verify)
```

See [`SETUP.md`](SETUP.md) for details and [`TWO-COMPUTER-WORKFLOW.md`](TWO-COMPUTER-WORKFLOW.md)
for the weekly two-machine routine. For skills and agent orchestration, see
[`ORCHESTRATION.md`](ORCHESTRATION.md).
