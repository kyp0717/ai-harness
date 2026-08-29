---
name: kimi-integration
description: >-
  Set up or repair Kimi Code on a DeepSeek Harness machine — ACP subagent bridge,
  subscription login for the main model (kimi-coding / k3), and recovery from
  "OAuth refresh failed" errors. Run this when a machine needs Kimi wired in or
  when a Kimi session reports auth failures.
whenToUse: >-
  Use when asked to deploy Kimi on a harness machine, when a Kimi session shows
  "OAuth refresh failed for kimi-coding", when the subagent_kimi tool is missing,
  or when moving Kimi configuration to a new computer.
---

# Kimi Code integration on a DeepSeek Harness machine

This skill encodes the runbook in `SETUP.md` / `KIMI-INTEGRATION.md` of the
`ai-harness` repo. The repo must be cloned at a known path (this workspace
root). All commands assume `cd <repo root>`.

## Prerequisites (check each)

- `node --version` ≥ 18
- `dsh` harness installed and booted once (`dsh web`) so the `web` profile
  exists at `$DSH_HOME/profiles/web`
- Kimi Code CLI: `kimi --version` — if missing, install per
  https://github.com/MoonshotAI/kimi-code

## 1. ACP subagent bridge (delegation tool `subagent_kimi`)

```bash
npm run setup            # idempotent: installs the ACP bridge, patches the profile, creates the kimi preset
npm run setup:dry        # preview first if desired
```

Verify: `dsh --profile web --dump-config | grep -A6 subagent-kimi`.

## 2. Main model on your Kimi subscription (no API key)

Two paths — prefer 2a (independent credential):

### 2a. Independent login (recommended)

```bash
npm run kimi-login       # interactive: prints URL + code; complete in the browser
```

Gives the harness its OWN token lineage so its background refreshes can never
invalidate the CLI's login.

### 2b. Bridge the CLI's token (fallback)

```bash
kimi login               # once per machine, if not already logged in
npm run bridge           # validates the token first, then imports it
```

⚠️ This SHARES one token lineage between CLI and harness — if either refreshes
and the server rotates, the other can break ("OAuth refresh failed …
invalid grant"). Prefer 2a.

## 3. Default model

Ensure `~/.dsh/settings.yaml` contains:

```yaml
agent-default-model:
  provider: kimi-coding
  model: k3
```

`k3` is Kimi K3 with a 1M-token context window.

## 4. Finish

1. Restart the harness GUI (`dsh web`).
2. Start a new session; it should run on `kimi-coding / k3`.
3. Verify: the `subagent_kimi` tool is in the catalog; delegate a task to it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `OAuth refresh failed for kimi-coding … invalid grant` | Token lineage died (usually shared-lineage rotation). Run `npm run kimi-login` (or `kimi login` + `npm run bridge`). |
| `bridge: the CLI's refresh token is rejected` | The CLI login is dead — run `kimi login` first, or use `npm run kimi-login`. |
| `patch: entry "subagent-kimi" not found` | New patch rows must use `- insert:` blocks, not bare `- id:` rows. |
| `subagent-acp: child start failed` | `command` path wrong in `cordis.patch.yml` — use the absolute `kimi` path. |

## Notes

- Secrets (kimi login, harness credential) are per-machine; never commit them.
- The CLI's own login (`kimi`) is independent of the harness credential after
  2a — a broken one does not affect the other.
