import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { apply, Config } from '../../lib/index.js'

const serverPath = 'C:/Users/A/Documents/cwtools-vscode/artifacts/bin/Main/debug/CWTools Server.exe'
const rulesPath = 'C:/Users/A/Documents/cwtools-vscode/submodules/cwtools-stellaris-config/config'
const sample = 'C:/Users/A/Documents/cwtools-vscode/client/test/sample'
const fixture = path.resolve('tests/.live-write-fixture')

function host(workspaceRoot, write = false) {
  const definitions = new Map()
  const disposers = []
  const ctx = {
    effect: (fn) => { const dispose = fn(); disposers.push(dispose); return dispose },
    systemPrompt: { section: () => () => {} },
    tools: { register: (definition) => { definitions.set(definition.name, definition); return () => {} } },
    workingDirectory: { ensure: async () => workspaceRoot },
  }
  const config = Config({
    backend: { serverPath, rulesPath, game: 'stellaris', startupTimeoutMs: 120_000, requestTimeoutMs: 60_000 },
    writeTools: { write_localisation: write },
  })
  apply(ctx, config)
  return { definitions, dispose: () => { for (const dispose of disposers.reverse()) dispose() } }
}

function execute(host, name, args) {
  const definition = host.definitions.get(name)
  assert(definition, 'native tool not registered: ' + name)
  return definition.execute(args, { agent: { session: { id: 'live' } }, signal: new AbortController().signal })
}

const semantic = host(sample)
const report = {}
try {
  assert.equal(semantic.definitions.has('write_localisation'), false)
  report.defaultWriteAbsent = true
  const rules = await execute(semantic, 'query_rules', { category: 'trigger', name: 'has_energy', scope: 'ship' })
  assert.equal(rules.ok, true)
  report.queryRules = { status: rules.status, hasData: rules.data !== undefined }

  const types = await execute(semantic, 'query_types', { typeName: 'ship_size', limit: 2 })
  assert.equal(types.ok, true)
  report.queryTypes = { status: types.status, readiness: types.readiness ?? null, dataKind: Array.isArray(types.data) ? 'array' : typeof types.data }

  const targeting = await execute(semantic, 'query_targeting_weight', {
    attacker: { tracking: 0, sizeMultiplier: 3 },
    weapon: { minDamage: 600, maxDamage: 1500, accuracy: 0.85, tracking: 0, shieldDamage: 0.5, armorDamage: 2, hullDamage: 1.5 },
    target: { sizeMultiplier: 5, evasion: 0.6, distance: 72, hull: 240, shield: 225, armor: 225, armed: true },
    targetWeightMultModifier: 0.561,
  })
  assert.equal(targeting.ok, true)
  assert(Math.abs(targeting.data.shipChain.W1 - 0.869565) < 0.001)
  assert(Math.abs(targeting.data.weapon.p - 0.25) < 0.001)
  report.targeting = { W1: targeting.data.shipChain.W1, p: targeting.data.weapon.p }

  const diagnostics = await execute(semantic, 'get_diagnostics', { limit: 5 })
  assert.equal(diagnostics.ok, true)
  report.diagnostics = { status: diagnostics.status, readiness: diagnostics.readiness ?? null, count: diagnostics.data?.diagnostics?.length ?? null }
} finally {
  semantic.dispose()
}

await mkdir(path.join(fixture, 'common'), { recursive: true })
await mkdir(path.join(fixture, 'localisation'), { recursive: true })
await writeFile(path.join(fixture, 'descriptor.mod'), 'name="DSH live write fixture"\n', 'utf8')
await writeFile(path.join(fixture, 'common', 'test.txt'), 'test = { }\n', 'utf8')
await writeFile(path.join(fixture, 'localisation', 'dsh_test_l_english.yml'), Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('l_english:\n', 'utf8')]))
const writing = host(fixture, true)
try {
  assert.equal(writing.definitions.has('write_localisation'), true)
  const result = await execute(writing, 'write_localisation', {
    filePath: 'localisation/dsh_test_l_english.yml',
    language: 'english',
    entries: [{ key: 'DSH_LIVE_TEST_KEY', value: 'Live test' }],
  })
  assert.equal(result.ok, true)
  const bytes = await readFile(path.join(fixture, 'localisation', 'dsh_test_l_english.yml'))
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf])
  const text = bytes.toString('utf8')
  assert(text.includes('DSH_LIVE_TEST_KEY:0 "Live test"'))
  const created = await execute(writing, 'write_localisation', {
    filePath: 'localisation/dsh_created_l_english.yml',
    language: 'english',
    entries: [{ key: 'DSH_CREATED_KEY', value: 'Created' }],
  })
  assert.equal(created.ok, true)
  const createdBytes = await readFile(path.join(fixture, 'localisation', 'dsh_created_l_english.yml'))
  assert.deepEqual([...createdBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf])
  report.write = { ok: true, bomPreserved: true, bomCreated: true, key: true }

  let denied = false
  try {
    await execute(writing, 'write_localisation', {
      filePath: '../escape.yml', language: 'english', entries: [{ key: 'ESC', value: 'no' }],
    })
  } catch {
    denied = true
  }
  assert.equal(denied, true)
  report.pathTraversalDenied = true
} finally {
  writing.dispose()
  await unlink(path.join(fixture, 'descriptor.mod'))
  await unlink(path.join(fixture, 'common', 'test.txt'))
  await unlink(path.join(fixture, 'localisation', 'dsh_test_l_english.yml'))
  await unlink(path.join(fixture, 'localisation', 'dsh_created_l_english.yml'))
  await rmdir(path.join(fixture, 'common'))
  await rmdir(path.join(fixture, 'localisation'))
  await rmdir(fixture)
}
console.log(JSON.stringify(report, null, 2))
