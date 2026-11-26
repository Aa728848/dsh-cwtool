// Fails when the browser client bundle requests a Node builtin.
//
// `lib/client.js` runs only inside the DSH client module loader, whose module
// table holds platform seed modules, materialized modules and registered
// package factories, never Node builtins. A leaked `require("fs")` throws
// before `apply()` and the settings section never registers, which Node-side
// unit tests cannot observe. Run after `tsdown`.
import { readFile, readdir } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

const libPath = fileURLToPath(new URL('../lib/', import.meta.url))
const bundlePaths = (await readdir(libPath)).filter(name => name === 'client.js' || name.endsWith('.cjs')).sort().map(name => libPath + name)
const builtins = new Set(builtinModules.flatMap(name => [name, 'node:' + name]))
const isBuiltin = specifier => specifier.startsWith('node:') || builtins.has(specifier) || builtins.has(specifier.split('/')[0])

for (const bundlePath of bundlePaths) {
const source = await readFile(bundlePath, 'utf8')
const pattern = /\b(?:require|import)\(\s*(["'`])([^"'`]+)\1\s*\)/g
const leaked = new Set()
const relative = new Set()
for (const match of source.matchAll(pattern)) {
  if (isBuiltin(match[2])) leaked.add(match[2])
  if (match[2].startsWith('.')) relative.add(match[2])
}

if (relative.size > 0) {
  process.stderr.write(bundlePath.split('/').pop() + ' requests unregistered relative modules: ' + [...relative].sort().join(', ') + '\n')
  process.stderr.write('DSH materializes one client module; inline dynamic imports instead of emitting chunks.\n')
  process.exit(1)
}

if (leaked.size > 0) {
  process.stderr.write('lib/client.js requests Node builtins: ' + [...leaked].sort().join(', ') + '\n')
  process.stderr.write('Browser code must not import Host modules; see ARCHITECTURE.md.\n')
  process.exit(1)
}
process.stdout.write(bundlePath.split('/').pop() + ': no Node builtin requests (' + source.length + ' bytes)\n')
}
