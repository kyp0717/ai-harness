# ai-harness

DeepSeek Harness (dsh) deployment configuration — the Kimi Code integration and
the operator docs for keeping **two computers in identical configuration**
(you swap between them weekly).

## What's in this repo

| Path | Purpose |
|---|---|
| `scripts/setup-kimi.mjs` | One-command, **idempotent** setup: installs the Kimi Code ACP bridge into the dsh `web` profile, patches the profile, creates the `kimi` agent preset. Run it on every machine, every time. |
| `scripts/bridge-kimi-token.mjs` | **Idempotent** bridge: imports your Kimi Code CLI's *subscription* OAuth tokens into the harness credential store so the `kimi-coding` provider works with your monthly subscription — no pay-as-you-go API key. |
| `vendor/` | Pinned tarballs (with SHA-256 in git history) for offline install — no npm registry needed on the target machine. |
| `SETUP.md` | Step-by-step for setting up **one** machine from scratch. |
| `TWO-COMPUTER-WORKFLOW.md` | The weekly-swap procedure: what's synced, what's per-machine, the checklist. |
| `KIMI-INTEGRATION.md` | The original deep-dive: how the integration works, the manual steps, the patch-syntax gotchas, troubleshooting. |

## Quick start (one machine)

```bash
# 0. Prerequisites on the machine
node --version          # >= 18
kimi --version          # Kimi Code CLI installed; run `kimi login` once
dsh web                 # start the harness ONCE so the profile initializes, then stop it

# 1. Get this repo
git clone git@github.com:kyp0717/ai-harness.git && cd ai-harness

# 2. Apply the Kimi integration (idempotent — safe to re-run)
npm run setup

# 3. Optional: use your Kimi Code SUBSCRIPTION as the main model (no API key)
npm run bridge && npm run bridge:verify

# 4. Restart the harness GUI and verify (SETUP.md § Verify)
```

See [`SETUP.md`](SETUP.md) for details and [`TWO-COMPUTER-WORKFLOW.md`](TWO-COMPUTER-WORKFLOW.md)
for the weekly two-machine routine.
