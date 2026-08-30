# CLONE-TO-NEW-MACHINE.md — clone this fully-configured harness onto another computer

The one document that walks the **entire** process of transporting this
DeepSeek Harness setup to a fresh machine — from an empty computer to an
identical deployment. Use it for:

- a brand-new machine (full clone),
- an existing machine that drifted (re-sync), or
- a weekly machine swap (the 3-command routine at the end).

> Details behind every step live in `SETUP.md` (per-machine) and
> `TWO-COMPUTER-WORKFLOW.md` (parity/swap). This doc is the consolidated
> runbook — start here.

---

## 1. The mental model

**The repo is the recipe; the scripts bake the config.** Nothing on a machine
is a copy of a repo file — every config file is *regenerated* by `npm run
setup` and `npm run skills:install`. That's what makes the clone exact and
idempotent:

```
git clone ai-harness  →  npm run setup (writes ALL harness config)
                     →  npm run skills:install (65 skills)
                     →  npm run kimi-login + GUI keys (per-machine secrets)
```

## 2. Where every piece of the configuration lives

| Machine config file | Repo source | Applied by |
|---|---|---|
| `~/.dsh/profiles/web/cordis.patch.yml` (kimi provider row, default preset `kimi`) | `scripts/setup-kimi.mjs` | `npm run setup` |
| `~/.dsh/.agent-presets/kimi/agent.cordis.yml` (kimi preset + `subagent_kimi` tool) | `scripts/setup-kimi.mjs` | `npm run setup` |
| `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-subagent-acp` + `@agentclientprotocol/sdk` | `vendor/*.tgz` (pinned) | `npm run setup` |
| `~/.dsh/settings.yaml` — `kimi-coding` profile, **NVIDIA 30-model profile**, default model `kimi-coding/k3` | `scripts/setup-kimi.mjs` | `npm run setup` |
| `~/.dsh/skills/*` — all 65 skills (poteto pstack + noodle + ours) | `.agents/skills/` (vendored) | `npm run skills:install` |
| Subscription credential (`llm-pi-ai/kimi-coding`) | **secret — not in repo** | `npm run kimi-login` (per machine) |
| API keys (`NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`, …) | **secret — not in repo** | GUI → Settings → API keys |
| The dsh harness binary | **not in repo** (pinned install) | `npx @deepseek-ai/dsh@0.1.1-rc.2` |

## 3. Prerequisites on the target machine

```bash
node --version                          # >= 18
git --version
# optional but recommended (powers subagent_kimi):
curl -fsSL https://kimi.moonshot.cn/install/install.sh | bash   # Kimi Code CLI
```

## 4. Fresh machine — full clone (7 steps)

**Step 1 — Boot the harness once** (creates the `web` profile; pinned version):

```bash
npx --yes @deepseek-ai/dsh@0.1.1-rc.2 --profile web
# let it initialize, then stop it (Ctrl-C / close the window)
```

**Step 2 — Clone the repo:**

```bash
git clone git@github.com:kyp0717/ai-harness.git && cd ai-harness
```

**Step 3 — Apply the full harness configuration (idempotent):**

```bash
npm run setup
```

This writes everything in §2's table: the ACP bridge packages (from
`vendor/`), the profile patch, the `kimi` preset, and `settings.yaml`
(kimi-coding + NVIDIA 30 models + default model `kimi-coding/k3`).

**Step 4 — Subscription credential (per machine, interactive):**

```bash
npm run kimi-login
# prints a URL + code → open it, sign in with your Kimi subscription account
```

**Step 5 — Install the 65 skills globally:**

```bash
npm run skills:install
```

**Step 6 — Secrets (per machine, GUI):**

Settings → API keys → add `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY` (and
`MOONSHOT_API_KEY` / `KIMI_API_KEY` if you use those routes).

**Step 7 — Restart the GUI and verify (parity check):**

```bash
# restart dsh web, then:
dsh --profile web --dump-config | grep -A6 subagent-kimi     # provider row present
grep -c tool-subagent-kimi ~/.dsh/.agent-presets/kimi/agent.cordis.yml   # → 1
cat ~/.dsh/settings.yaml    # kimi-coding/k3 default + nvidia profile present
ls ~/.dsh/skills/ | wc -l   # → 65
```

## 5. Existing machine — re-sync / weekly swap (3 commands)

```bash
cd ai-harness && git pull
npm run setup          # idempotent: re-applies anything that changed
npm run skills:install # refresh skills from the repo
# restart the GUI; run the parity check above
```

That's the whole weekly routine. (Re-run `npm run kimi-login` only if a token
dies — the error "OAuth refresh failed … invalid grant" means re-login.)

## 6. Per-machine items (never in git — by design)

| Item | How it's done per machine |
|---|---|
| Kimi subscription credential | `npm run kimi-login` (device-code, ~1 min) |
| API keys | GUI → Settings → API keys |
| Kimi CLI login (for `subagent_kimi`) | `kimi login` in a terminal |
| GUI launch method | your launcher; always pin `@deepseek-ai/dsh@0.1.1-rc.2` |

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `profile ... does not exist` from `npm run setup` | Run Step 1 first (boot dsh once). |
| `NVIDIA (free tier)` missing in Models | Key not set or GUI not restarted — add `NVIDIA_API_KEY`, restart. |
| `OAuth refresh failed … invalid grant` | Token lineage died — `npm run kimi-login` (or `kimi login` + `npm run bridge`). |
| Bridge version mismatch on `npm run setup` | Machine B's dsh must be `0.1.1-rc.2` (Step 1 pins it). |
| Skills missing in a session | `npm run skills:install`, then start a **new** session. |
| API key "invalid" for a catalog model | Free-tier availability rotates on build.nvidia.com — try another model or verify on the provider's site. |

## 8. References

- `SETUP.md` — per-machine setup detail (§0–§4b) and the NVIDIA free tier.
- `TWO-COMPUTER-WORKFLOW.md` — swap routine, config-source table, known-good snapshot, parity checks.
- `HANDOFF.md` — session continuation brief.
