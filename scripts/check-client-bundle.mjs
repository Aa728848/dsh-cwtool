// Fails when the browser client bundle requests a Node builtin.
//
// `lib/client.js` runs only inside the DSH client module loader, whose module
// table holds platform seed modules, materialized modules and registered
// package factories, never Node builtins. A leaked `require("fs")` throws
// before `apply()` and the settings section never registers, which Node-side
// unit tests cannot observe. Run after `tsdown`.
import { readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

const bundlePath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const builtins = new Set(builtinModules.flatMap(name => [name, 'node:' + name]))
const isBuiltin = specifier => specifier.startsWith('node:') || builtins.has(specifier) || builtins.has(specifier.split('/')[0])

const source = await readFile(bundlePath, 'utf8')
const pattern = /\b(?:require|import)\(\s*(["'`])([^"'`]+)\1\s*\)/g
const leaked = new Set()
for (const match of source.matchAll(pattern)) {
  if (isBuiltin(match[2])) leaked.add(match[2])
}

if (leaked.size > 0) {
  process.stderr.write('lib/client.js requests Node builtins: ' + [...leaked].sort().join(', ') + '\n')
  process.stderr.write('Browser code must not import Host modules; see ARCHITECTURE.md.\n')
  process.exit(1)
}
process.stdout.write('lib/client.js: no Node builtin requests (' + source.length + ' bytes)\n')
