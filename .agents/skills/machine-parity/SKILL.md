---
name: machine-parity
description: >-
  Keep two DeepSeek Harness computers (weekly swap) in identical configuration:
  sync the repo, run the idempotent setup, redo per-machine logins, and verify
  parity. Run when asked to prepare for a machine swap or to bring the other
  computer up to date.
whenToUse: >-
  Use when the user alternates between two computers and needs both harnesses
  configured identically, or when asked to "set up the other machine".
---

# Two-machine parity routine

Reference: `TWO-COMPUTER-WORKFLOW.md` in this repo. The repo is the single
source of truth; the scripts are idempotent.

## Before leaving machine A

```bash
cd <repo root>
git add -A && git commit -m "harness config update"   # if anything changed
git push
```

Never commit secrets: `~/.kimi-code/`, `~/.dsh/.credentials.yaml` records,
and API keys stay per-machine.

## On machine B (before starting work)

```bash
cd <repo root>
git pull
npm run setup            # idempotent: ACP bridge + profile patch + kimi preset
npm run kimi-login       # per machine: independent subscription login (device code)
npm run skills:install   # optional: make repo skills available in every workspace
# restart the harness GUI, then verify
```

## Parity verification (both machines should match)

```bash
dsh --profile web --dump-config | grep -A6 subagent-kimi    # provider row present
grep -c tool-subagent-kimi ~/.dsh/.agent-presets/kimi/agent.cordis.yml   # 1
grep -A2 "default:" ~/.dsh/profiles/web/cordis.patch.yml | tail -1        # kimi
node -e "console.log(require('/home/<you>/.dsh/profiles/node_modules/@deepseek-ai/dsh-subagent-acp/package.json').version)"  # 0.1.1-rc.2
```

And `~/.dsh/settings.yaml` should contain `agent-default-model: {provider:
kimi-coding, model: k3}` on both machines.

## Per-machine items (differ by design — do not sync)

- Kimi CLI login state (`~/.kimi-code/`)
- Harness subscription credential (`~/.dsh/.credentials.yaml`, record
  `llm-pi-ai/kimi-coding`) — created per machine by `npm run kimi-login`
- API keys in the GUI (Settings → API keys)

## Version pinning

Launch dsh with the same pinned version on both machines
(`@deepseek-ai/dsh@0.1.1-rc.2`). If a version differs, re-check the ACP
bridge version match (`npm run setup` fails loudly on mismatch).
