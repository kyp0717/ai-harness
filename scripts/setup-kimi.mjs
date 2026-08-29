#!/usr/bin/env node
/**
 * setup-kimi.mjs — one-command Kimi Code integration for a DeepSeek Harness
 * (dsh) deployment. Idempotent: safe to re-run on every machine (and every
 * week) — it only changes what is missing or out of date.
 *
 * Usage:
 *   node scripts/setup-kimi.mjs [--dry-run] [--no-default-preset] [--verbose]
 *
 * What it does (mirrors the manual steps in KIMI-INTEGRATION.md):
 *   1. Locates the Kimi Code CLI binary (PATH, then ~/.kimi-code/bin/kimi).
 *   2. Locates the dsh harness install and reads its version.
 *   3. Installs the version-matched ACP bridge
 *      (@deepseek-ai/dsh-subagent-acp) and its ACP SDK dependency
 *      (@agentclientprotocol/sdk) into the web profile's node_modules —
 *      preferring the pinned tarballs in ./vendor, falling back to the npm
 *      registry (pinned to the harness version).
 *   4. Patches <DSH_HOME>/profiles/web/cordis.patch.yml: inserts the `kimi`
 *      provider row (in the loader's `- insert:` form) and sets the default
 *      agent preset to `kimi` (unless --no-default-preset).
 *   5. Creates <DSH_HOME>/.agent-presets/kimi/agent.cordis.yml — a copy of the
 *      shipped `standard` preset plus the `subagent_kimi` tool row.
 *   6. Prints next steps (restart the GUI, verify, per-machine secrets).
 *
 * Secrets are NEVER touched: Kimi credentials/oauth and provider API keys stay
 * machine-local (see SETUP.md § "Per-machine items").
 *
 * Requires: node >= 18, tar (POSIX), and for the npm-registry fallback also
 * npm. POSIX paths are assumed (both of your machines run Linux).
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── constants ───────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const VENDOR_DIR = join(REPO_ROOT, 'vendor')
const NPM_CACHE_DIR = join(REPO_ROOT, '.npm-cache')

const HOME = homedir()
const DSH_HOME = process.env.DSH_HOME || join(HOME, '.dsh')
const PROFILE = 'web'
const PROFILE_DIR = join(DSH_HOME, 'profiles', PROFILE)
const PROFILE_NODE_MODULES = join(DSH_HOME, 'profiles', 'node_modules')
const PATCH_FILE = join(PROFILE_DIR, 'cordis.patch.yml')
const PRESET_DIR = join(DSH_HOME, '.agent-presets', 'kimi')
const PRESET_FILE = join(PRESET_DIR, 'agent.cordis.yml')

const BRIDGE = '@deepseek-ai/dsh-subagent-acp'
const SDK = '@agentclientprotocol/sdk'
const BRIDGE_PKG = join(PROFILE_NODE_MODULES, BRIDGE, 'package.json')
const SDK_PKG = join(PROFILE_NODE_MODULES, SDK, 'package.json')

const KIMI_BIN_CANDIDATES = ['~/.kimi-code/bin/kimi', '~/.kimi/bin/kimi']

/** Marker section boundaries the script owns inside cordis.patch.yml. */
const SECTION_START = '# === KIMI SETUP (managed by setup-kimi.mjs) ==='
const SECTION_END = '# === END KIMI SETUP ==='

// ── tiny helpers ────────────────────────────────────────────────────────────

const flags = {
  dryRun: process.argv.includes('--dry-run'),
  defaultPreset: !process.argv.includes('--no-default-preset'),
  verbose: process.argv.includes('--verbose'),
}

const out = {
  step: (msg) => console.log(`\n▸ ${msg}`),
  ok: (msg) => console.log(`  ✓ ${msg}`),
  info: (msg) => console.log(`  · ${msg}`),
  warn: (msg) => console.log(`  ! ${msg}`),
  fail: (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1 },
}

const expanded = (p) => (p.startsWith('~') ? join(HOME, p.slice(1)) : p)

function read(p) {
  try { return readFileSync(p, 'utf8') } catch { return undefined }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (r.error) throw r.error
  return r
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const s = join(from, entry.name)
    const d = join(to, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else copyFileSync(s, d)
  }
}

/** Extract an npm tarball (single top-level `package/` dir) into `targetDir`. */
function installFromTarball(tgz, targetDir) {
  const tmp = join(dirname(targetDir), `.tmp-${process.pid}-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
  try {
    const r = run('tar', ['xzf', tgz, '-C', tmp])
    if (r.status !== 0) throw new Error(`tar extraction failed for ${tgz}: ${r.stderr}`)
    const pkgDir = join(tmp, 'package')
    if (!existsSync(pkgDir)) throw new Error(`tarball ${tgz} has no package/ dir`)
    rmSync(targetDir, { recursive: true, force: true })
    mkdirSync(dirname(targetDir), { recursive: true })
    try { renameSync(pkgDir, targetDir) } catch {
      copyDir(pkgDir, targetDir) // cross-device fallback
      rmSync(pkgDir, { recursive: true, force: true })
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function pkgVersion(pkgFile) {
  const raw = read(pkgFile)
  if (!raw) return undefined
  try { return JSON.parse(raw).version } catch { return undefined }
}

function yamlQuote(s) {
  // Double-quoted YAML scalar with minimal escaping — safe for file paths.
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// ── step 1: locate the Kimi Code CLI ────────────────────────────────────────

function locateKimi() {
  const which = run('bash', ['-lc', 'command -v kimi 2>/dev/null || true'], { stdio: ['ignore', 'pipe', 'ignore'] })
  const onPath = which.stdout?.trim()
  if (onPath) return onPath
  for (const cand of KIMI_BIN_CANDIDATES) {
    const p = expanded(cand)
    if (existsSync(p)) return p
  }
  return undefined
}

// ── step 2: locate the dsh install and harness version ─────────────────────

function candidateDshDirs() {
  const list = []
  // The running profile's flat node_modules mirror.
  list.push(join(PROFILE_NODE_MODULES, 'dsh'))
  // npx cache installs.
  const npxRoot = join(HOME, '.npm', '_npx')
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      list.push(join(npxRoot, entry, 'node_modules', '@deepseek-ai', 'dsh'))
    }
  }
  // Global npm install.
  const g = run('npm', ['root', '-g'], { stdio: ['ignore', 'pipe', 'ignore'] })
  if (g.status === 0 && g.stdout?.trim()) {
    list.push(join(g.stdout.trim(), '@deepseek-ai', 'dsh'))
  }
  return list
}

function findDsh() {
  for (const dir of candidateDshDirs()) {
    const pkg = join(dir, 'package.json')
    if (!existsSync(pkg)) continue
    try {
      if (JSON.parse(readFileSync(pkg, 'utf8')).name === '@deepseek-ai/dsh') return dir
    } catch { /* keep searching */ }
  }
  return undefined
}

// ── step 3: package install ────────────────────────────────────────────────

function vendoredTarball(packageName, version) {
  const norm = packageName.replace('@', '').replace('/', '-')
  const exact = join(VENDOR_DIR, `${norm}-${version}.tgz`)
  if (existsSync(exact)) return exact
  if (!existsSync(VENDOR_DIR)) return undefined
  // Fallback: any vendor tarball of this package (version must still match).
  for (const f of readdirSync(VENDOR_DIR)) {
    if (f.startsWith(norm) && f.endsWith('.tgz')) {
      const p = join(VENDOR_DIR, f)
      out.warn(`vendored ${f} does not match requested version ${version} — using it anyway`)
      return p
    }
  }
  return undefined
}

function npmPackTo(packageSpec, destDir) {
  mkdirSync(destDir, { recursive: true })
  const r = run('npm', ['--cache', NPM_CACHE_DIR, 'pack', packageSpec, '--pack-destination', destDir],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0) throw new Error(`npm pack failed for ${packageSpec}: ${r.stderr}`)
  const name = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean).pop()
  if (!name) throw new Error(`npm pack produced no tarball name for ${packageSpec}`)
  return join(destDir, name)
}

function ensurePackage(packageName, version, pkgFile) {
  const current = pkgVersion(pkgFile)
  if (current === version) {
    out.ok(`${packageName} ${version} already installed`)
    return
  }
  if (current !== undefined) out.warn(`${packageName}: installed ${current}, need ${version} — reinstalling`)
  const targetDir = dirname(pkgFile)
  const tgz = vendoredTarball(packageName, version)
  if (tgz) {
    out.info(`using vendored tarball ${tgz} (sha256 ${sha256(tgz).slice(0, 12)}…)`)
  } else {
    out.info(`fetching ${packageName}@${version} from the npm registry`)
    if (flags.dryRun) { out.info(`(dry-run) would npm pack ${packageName}@${version}`); return }
    const fetched = npmPackTo(`${packageName}@${version}`, NPM_CACHE_DIR)
    installFromTarball(fetched, targetDir)
    rmSync(fetched, { force: true })
    out.ok(`${packageName} ${version} installed → ${targetDir}`)
    return
  }
  if (flags.dryRun) { out.info(`(dry-run) would extract ${tgz} → ${targetDir}`); return }
  installFromTarball(tgz, targetDir)
  out.ok(`${packageName} ${version} installed → ${targetDir}`)
}

/**
 * Verify the bridge actually imports from the profile's resolution path.
 * A fresh profile's node_modules mirror must already contain the harness's
 * base packages (peers like @deepseek-ai/schemastery); if the harness was
 * started at least once, they are there. This check turns the most common
 * fresh-machine failure (forgot to boot the harness once) into a clear
 * message instead of a boot-time crash.
 */
function verifyBridge() {
  if (flags.dryRun) { out.info('(dry-run) verification skipped'); return }
  const r = run(process.execPath, ['--input-type=module', '--eval',
    "const m = await import('@deepseek-ai/dsh-subagent-acp'); console.log(Object.keys(m).join(','))"],
    { cwd: PROFILE_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status === 0) {
    out.ok(`bridge imports from the profile (exports: ${r.stdout.trim()})`)
  } else {
    out.warn(`bridge failed to import from ${PROFILE_DIR}: ${(r.stderr ?? '').trim().split('\n')[0]}`)
    out.warn('if this is a fresh machine, start the harness once (`dsh --profile web`) so its base packages populate the profile node_modules, then re-run this script')
  }
}

// ── step 4: cordis.patch.yml ───────────────────────────────────────────────

function patchSection(command, includeDefault) {
  const lines = [
    SECTION_START,
    '# Kimi Code CLI as an ACP subagent provider (host plane).',
    '# - insert: form is REQUIRED for new rows — a bare `- id:` row only',
    '#   overrides an existing entry (the loader warns "entry not found").',
    '- insert:',
    '    - id: subagent-kimi',
    "      name: '@deepseek-ai/dsh-subagent-acp'",
    '      config:',
    '        providerName: kimi',
    `        command: ${yamlQuote(command)}`,
    '        args:',
    '          - acp',
    "        permission: allow   # auto-approve the child's permission prompts",
  ]
  if (includeDefault) {
    lines.push('', '# Make the `kimi` preset the default for new agents/sessions.', '- id: agent-presets', '  config:', '    default: kimi')
  }
  lines.push(SECTION_END)
  return lines.join('\n') + '\n'
}

function writePatch(command) {
  const existing = read(PATCH_FILE) ?? ''
  if (/insert:\s*\n\s*- id: subagent-kimi/.test(existing)) {
    out.ok('cordis.patch.yml already mounts the `kimi` provider (insert form)')
    return
  }
  if (/^\s*- id: subagent-kimi\s*$/m.test(existing)) {
    out.warn('cordis.patch.yml contains a BARE `- id: subagent-kimi` row, which the loader treats as an override of a missing entry — it will NOT mount. Remove it and re-run this script.')
    return
  }

  const section = patchSection(command, flags.defaultPreset)
  const body = existing.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).join('\n').trim()
  const stockTemplate = body === '' || body === '[]'
  let next
  if (stockTemplate) {
    next = `# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; \`!!js\` expressions allowed).\n\n${section}`
  } else {
    next = existing.replace(/\s*$/, '') + '\n\n' + section
  }
  if (flags.dryRun) { out.info(`(dry-run) would write ${PATCH_FILE}`); return }
  writeFileSync(PATCH_FILE, next)
  out.ok(`patched ${PATCH_FILE}`)
}

// ── step 5: kimi agent preset ──────────────────────────────────────────────

const TOOL_ROW = `
    # Kimi Code CLI delegation via the \`kimi\` ACP provider (registered by the
    # \`subagent-kimi\` host row in the profile patch). \`maxDepth\` is
    # provider-managed because the ACP provider cannot enforce a depth limit
    # inside the out-of-process child.
    - id: tool-subagent-kimi
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: kimi
        toolName: subagent_kimi
        backgroundMode: one-shot
        maxDepth: provider-managed
`

function standardPresetSource(dshDir) {
  const p = join(dshDir, 'config', 'agent-presets', 'standard', 'agent.cordis.yml')
  return existsSync(p) ? p : undefined
}

function writePreset(dshDir) {
  const src = standardPresetSource(dshDir)
  if (!src) {
    out.fail(`cannot find the shipped standard preset under ${dshDir}/config/agent-presets — unexpected harness layout; see KIMI-INTEGRATION.md for the manual steps`)
    return
  }
  if (read(PRESET_FILE)?.includes('tool-subagent-kimi')) {
    out.ok(`preset already contains the subagent_kimi tool (${PRESET_FILE})`)
    return
  }
  const marker = '\n    - id: workflow-worker-thread'
  const base = read(src)
  if (!base.includes(marker)) {
    out.fail(`the standard preset ${src} lacks the delegation-group marker "- id: workflow-worker-thread" — cannot auto-insert the tool row; see KIMI-INTEGRATION.md`)
    return
  }
  if (flags.dryRun) { out.info(`(dry-run) would write ${PRESET_FILE} (from ${src})`); return }
  mkdirSync(PRESET_DIR, { recursive: true })
  writeFileSync(PRESET_FILE, base.replace(marker, TOOL_ROW + marker, 1))
  out.ok(`created ${PRESET_FILE} (copy of the standard preset + subagent_kimi tool)`)
}

// ── main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('Kimi Code integration — DeepSeek Harness setup')
  console.log(`  DSH_HOME : ${DSH_HOME}`)
  console.log(`  profile  : ${PROFILE_DIR}`)
  console.log(`  mode     : ${flags.dryRun ? 'DRY-RUN (no writes)' : 'apply'}${flags.defaultPreset ? '' : ' (default preset NOT changed)'}`)

  if (!existsSync(PROFILE_DIR)) {
    out.fail(`profile ${PROFILE_DIR} does not exist — start the harness once first (e.g. \`dsh --profile ${PROFILE}\`) so it initializes`)
    return
  }

  // 1. Kimi binary
  out.step('1/5  Kimi Code CLI')
  const kimi = locateKimi()
  if (!kimi) {
    out.fail('kimi not found on PATH or in ~/.kimi-code/bin — install it first (https://github.com/MoonshotAI/kimi-code), then run `kimi login`')
  } else {
    out.ok(`kimi at ${kimi}`)
    const v = run(kimi, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] })
    if (v.status === 0) out.info(`version: ${v.stdout.trim()}`)
    if (!existsSync(join(HOME, '.kimi-code', 'config.toml'))) {
      out.warn('no ~/.kimi-code/config.toml found — run `kimi login` (or start `kimi` once) so the ACP child can authenticate')
    }
  }

  // 2. Harness install + version
  out.step('2/5  Harness install')
  const dshDir = findDsh()
  const harnessVersion = dshDir ? pkgVersion(join(dshDir, 'package.json')) : undefined
  if (dshDir) out.ok(`dsh at ${dshDir} (version ${harnessVersion ?? 'unknown'})`)
  else out.warn('could not locate the @deepseek-ai/dsh install — package install still attempted')
  if (harnessVersion && harnessVersion !== '0.1.1-rc.2') {
    out.warn(`harness version ${harnessVersion} — the bridge is version-matched; the script will try ${harnessVersion} and fail loudly if it is not published`)
  }

  // 3. Packages
  out.step('3/5  ACP bridge packages')
  const bridgeVersion = harnessVersion ?? '0.1.1-rc.2'
  ensurePackage(BRIDGE, bridgeVersion, BRIDGE_PKG)
  ensurePackage(SDK, '0.25.1', SDK_PKG)
  verifyBridge()

  // 4. Profile patch
  out.step('4/5  Profile patch (cordis.patch.yml)')
  if (!kimi) out.fail('skipping patch — kimi binary not resolved')
  else writePatch(kimi)

  // 5. Preset
  out.step('5/5  Agent preset')
  if (dshDir) writePreset(dshDir)
  else out.fail('skipping preset — dsh install not located')

  // Next steps
  console.log('\n────────────────────────────────────────────────────')
  console.log('Next steps:')
  console.log('  1. Restart the harness GUI (stop `dsh web`, start it again).')
  console.log('  2. Start a NEW session (it uses the `kimi` preset) and confirm')
  console.log('     the tool catalog contains `subagent_kimi`.')
  console.log('  3. Delegate a task: "delegate this to the kimi subagent".')
  console.log('  4. Per-machine secrets (never committed): Kimi login state and')
  console.log('     Settings → API keys → MOONSHOT_API_KEY / KIMI_API_KEY (for')
  console.log('     Kimi K2/K3 as the main model).')
}

try {
  main()
} catch (error) {
  console.error(`setup failed: ${error.stack ?? error}`)
  process.exitCode = 1
}
