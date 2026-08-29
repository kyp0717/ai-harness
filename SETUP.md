# SETUP.md — Set up one machine (Kimi Code + dsh parity)

This is the per-machine procedure. Run it on **both** computers so they end up
with the same harness configuration. It is written so that running it a second
time on the same machine is a no-op (the script is idempotent).

> Time: ~10 minutes the first time, ~1 minute on re-runs.

---

## 0. Prerequisites

| Requirement | Check | Notes |
|---|---|---|
| Node.js ≥ 18 | `node --version` | dsh requires it |
| `tar` (POSIX) | `tar --version` | used to unpack the vendored packages |
| Kimi Code CLI | `kimi --version` | install from <https://github.com/MoonshotAI/kimi-code>; the installer puts it at `~/.kimi-code/bin/kimi` |
| Kimi login | `kimi login` | one-time, per machine — the OAuth/credentials live under `~/.kimi-code/` and are **machine-local** |
| dsh harness | `dsh --version` | launch it once (`dsh web`) so the `web` profile initializes, then stop it |

## 1. Pin the same harness version on both machines

The integration is version-matched: the ACP bridge version must equal the
harness version. **This machine's harness is `0.1.1-rc.2`.** On the second
machine, launch dsh with the same pinned version:

```bash
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 --profile web        # first boot (initializes the profile)
# afterwards, launch the GUI the same way you do here (or use a pinned alias).
```

The setup script detects the harness version and installs the matching bridge;
it fails loudly if that bridge version does not exist on npm.

## 2. Get the repo and run the setup

```bash
git clone git@github.com:kyp0717/ai-harness.git && cd ai-harness

npm run setup:dry    # optional: preview what it will do (writes nothing)
npm run setup        # apply
```

What it does (see the header of `scripts/setup-kimi.mjs` for the full map):

1. Locates the Kimi CLI binary.
2. Locates the dsh install and reads its version.
3. Installs `@deepseek-ai/dsh-subagent-acp@<harness-version>` and
   `@agentclientprotocol/sdk@0.25.1` into `~/.dsh/profiles/node_modules`
   (from the pinned `vendor/` tarballs; falls back to the npm registry).
4. Patches `~/.dsh/profiles/web/cordis.patch.yml`:
   - inserts the `kimi` ACP provider row (loader `- insert:` form), and
   - sets the default agent preset to `kimi`.
5. Creates `~/.dsh/.agent-presets/kimi/agent.cordis.yml` — the shipped
   `standard` preset plus the `subagent_kimi` tool row.
6. Verifies the bridge imports from the profile's module resolution path.

## 3. Restart and verify

```bash
# stop the running GUI, then start it again
dsh web
```

In the GUI:

1. Start a **new** session (it uses the `kimi` preset by default).
2. Open the tool catalog — confirm `subagent_kimi` is listed.
3. Ask the agent to delegate: *"delegate this task to the kimi subagent."*
   Watch for a `kimi` process spawning (default model `kimi-code/k3-256k`).

Optional CLI verification (shows the composed tree contains the provider row):

```bash
dsh --profile web --dump-config | grep -A6 "subagent-kimi"
```

## Per-machine items (never committed, set once per machine)

These intentionally differ per machine and are **not** part of the repo:

- **Kimi credentials** — `~/.kimi-code/` (OAuth tokens, config.toml, sessions).
- **API keys for using Kimi as the main model** — in the harness GUI:
  Settings → API keys → `MOONSHOT_API_KEY` (provider `moonshotai`) or
  `KIMI_API_KEY` (provider `kimi-coding`). Then Settings → Models → pick
  e.g. `moonshotai / kimi-k2.7-code` and set it as the default agent model.

## Re-running (e.g. after a weekly swap, or after a harness upgrade)

`npm run setup` again — it detects what is already in place and only changes
what is missing or out of date. After any re-run: restart the GUI.
