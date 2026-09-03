# TWO-COMPUTER-WORKFLOW.md — keeping two machines in parity

You alternate between two computers every week. The goal: **both machines end
up with the same harness (dsh) configuration** — same Kimi Code integration,
same preset, same models — with the minimum of effort and zero secret leakage.

The repo is the single source of truth. Everything that can be automated lives
in `scripts/setup-kimi.mjs`; everything that must stay per-machine is listed
below so you never try to "sync" the wrong thing.

---

## What is synced vs. per-machine

| Item | Synced via repo? | Where it lives |
|---|---|---|
| Setup script + docs + pinned vendor tarballs | ✅ yes (this repo) | `scripts/`, `vendor/`, `*.md` |
| Token bridge script (subscription → harness) | ✅ yes (this repo) | `scripts/bridge-kimi-token.mjs` |
| Independent login script | ✅ yes (this repo) | `scripts/kimi-login.mjs` |
| All poteto skills (vendored) + starter skills | ✅ yes (this repo) | `.agents/skills/` (65 skills: noodle 32 + pstack 34 + ours, auto-discovered in this repo's sessions) |
| Skill installer | ✅ yes (this repo) | `scripts/install-skills.mjs` (`npm run skills:install`) |
| Harness version (pin to `0.1.1-rc.2`) | ✅ yes — documented + enforced by the script | `SETUP.md` § 1 |
| Profile patch (`cordis.patch.yml` kimi section) | ✅ yes — written by the script | `~/.dsh/profiles/web/cordis.patch.yml` |
| `kimi` agent preset | ✅ yes — written by the script | `~/.dsh/.agent-presets/kimi/agent.cordis.yml` |
| ACP bridge + SDK packages | ✅ yes — installed from `vendor/` by the script | `~/.dsh/profiles/node_modules/…` |
| Default model + provider profile (`settings.yaml`) | ✅ yes — written by `npm run setup` | `~/.dsh/settings.yaml` |
| User-root skills (`~/.dsh/skills/`) | ✅ yes — installed per machine via `npm run skills:install` | `~/.dsh/skills/` |
| Kimi login / OAuth / sessions | ❌ **per machine** | `~/.kimi-code/` |
| Subscription credential in the harness store | ❌ **per machine** (created by `npm run kimi-login`, or `npm run bridge` to import the CLI's) | `~/.dsh/.credentials.yaml` |
| Provider API keys (`MOONSHOT_API_KEY`, `KIMI_API_KEY`) | ❌ **per machine** (GUI Settings → API keys) | harness settings storage |
| dsh GUI launch method | ⚠️ per machine (same pinned version) | your shell / launcher |

**Rule:** never copy `~/.kimi-code/` or API keys between machines, and never
commit them to this repo. Each machine authenticates once (`kimi login`, plus
API keys in the GUI) — that takes two minutes and keeps credentials local.

### "Where does the harness know its config from?"

The harness has **no cloud sync** — it doesn't "know" anything by itself. Every
piece of configuration on a machine comes from exactly one place:

| Config file on the machine | Produced by | Sync mechanism |
|---|---|---|
| `~/.dsh/profiles/web/cordis.patch.yml` | `npm run setup` | repo → script |
| `~/.dsh/.agent-presets/kimi/agent.cordis.yml` | `npm run setup` | repo → script |
| `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-subagent-acp` (+ SDK) | `npm run setup` (from `vendor/`) | repo → script |
| `~/.dsh/settings.yaml` (default model `kimi-coding/k3`) | `npm run setup` | repo → script |
| `~/.dsh/.credentials.yaml` (subscription credential) | `npm run kimi-login` | **per machine** (device-code login) |
| `~/.dsh/skills/*` | `npm run skills:install` | repo `.agents/skills/` → script |
| `~/.kimi-code/` (CLI login) | `kimi login` | **per machine** |

So the answer to "how do I get machine B configured exactly like this one?" is
the 3-command bootstrap below — nothing else needs to be copied.

---

## Weekly swap — the routine

### Before leaving machine A

```bash
cd ai-harness
git add -A && git commit -m "harness config update"   # if anything changed
git push
```

(If you changed anything outside the repo — e.g. tweaked the preset by hand or
edited the profile patch — the *reproducible* way to move it is to change the
script/docs here instead, then re-run `npm run setup` on B.)

### On machine B (before you start working)

```bash
cd ai-harness
git pull
npm run setup          # idempotent: writes ALL harness config (bridge, patch, preset, settings.yaml)
npm run kimi-login     # per machine: independent subscription login for the harness (device-code)
npm run skills:install # repo's vendored skills → ~/.dsh/skills (identical set on both machines)
# restart the harness GUI, then verify (SETUP.md § 3)
```

That's the whole routine — the 3 commands are the complete answer to "how do
I get the other machine configured exactly like this one". Because `npm run
setup` is idempotent and self-verifying, running it every time you land on a
machine keeps both in parity even if one of them drifted. The subscription
login (`npm run kimi-login`, or `npm run bridge` to reuse the CLI's token
instead) is per-machine and must be re-done only when a token dies.

### While working on machine B

- If you make a harness-related change (new tool wiring, preset tweak, config
  file) that you want on both machines: **encode it in this repo** (script or
  docs) and commit. Do not hand-edit `~/.dsh` files on B and expect A to
  follow — hand edits are not synced.
- Secrets stay local: a new API key on B is added in the GUI on B, and again
  on A when you return — never in git.

---

## Version parity table (fill in per deployment)

| Component | Machine A | Machine B | Keep in sync by |
|---|---|---|---|
| dsh (harness) | `0.1.1-rc.2` | `0.1.1-rc.2` | launching with `@deepseek-ai/dsh@0.1.1-rc.2` |
| Kimi Code CLI | `0.38.0` | `0.38.0` | `kimi upgrade` occasionally, on both |
| ACP bridge | `@deepseek-ai/dsh-subagent-acp@0.1.1-rc.2` | same | `vendor/` + script |
| ACP SDK | `@agentclientprotocol/sdk@0.25.1` | same | `vendor/` + script |
| Default preset | `kimi` | `kimi` | script |
| Default model | `kimi-coding / k3` (1M context) | same | settings (this repo's setup writes it) |

## Known-good configuration snapshot (what "identical" means)

Verified on this machine (2026-08-28); both machines should match:

- **Profile** `~/.dsh/profiles/web/cordis.patch.yml` — `subagent-kimi` provider
  row (`command: <abs path to kimi>`, `args: [acp]`, `permission: allow`) and
  `agent-presets.default: kimi`, both inside the loader `- insert:` / override
  forms.
- **Preset** `~/.dsh/.agent-presets/kimi/agent.cordis.yml` — copy of the
  shipped `standard` preset + the `tool-subagent-kimi` row
  (`provider: kimi`, `toolName: subagent_kimi`, `backgroundMode: one-shot`,
  `maxDepth: provider-managed`).
- **Packages** in `~/.dsh/profiles/node_modules/`:
  `@deepseek-ai/dsh-subagent-acp@0.1.1-rc.2` (sha256
  `7a8e0b6a7547…d0970` of the vendored tarball) and
  `@agentclientprotocol/sdk@0.25.1` (sha256 `3c0a1f617167…8f9a1`).
- **Settings** `~/.dsh/settings.yaml` — `agent-default-model:
  {provider: kimi-coding, model: k3}`; `llm-pi-ai.providers.kimi-coding: {}`;
  `llm-pi-ai.providers.nvidia` (30-model free-tier profile, written by
  `npm run setup`).
- **Credential** `~/.dsh/.credentials.yaml` — record `llm-pi-ai/kimi-coding`,
  kind `grant`, type `oauth` (per-machine; values differ, structure matches).
- **Skills** — `.agents/skills/` holds the vendored pstack-strict set (30
  skills: 20 engineering principles + `poteto-mode` + workflow skills); the
  noodle collection, third-party packs, and harness-ops skills were removed
  2026-09-02. Synced via git; `~/.dsh/skills/` mirrors them per machine via
  `npm run skills:install`.

## Parity check (both machines)

```bash
dsh --profile web --dump-config | grep -A6 "subagent-kimi"   # provider row present
grep -c "tool-subagent-kimi" ~/.dsh/.agent-presets/kimi/agent.cordis.yml   # tool row present
node -e "console.log(require('~/.dsh/profiles/node_modules/@deepseek-ai/dsh-subagent-acp/package.json').version)"
cat ~/.dsh/settings.yaml                                     # default model kimi-coding/k3
ls ~/.dsh/skills/                                            # installed skills
```

The outputs should be identical on both machines. (Secrets obviously differ —
that's expected.)
