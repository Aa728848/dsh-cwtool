import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'tsdown'
import { transform } from 'lightningcss'

const hostExternal = [
  /^@deepseek-ai\//,
  'cwtools-shared',
  'cwtools-node',
]
const clientExternal = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-renderer/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-slots',
])
const isHostExternal = (specifier: string): boolean => hostExternal.some(entry =>
  typeof entry === 'string' ? entry === specifier : entry.test(specifier),
)
const cssPrefix = '\0dsh-cwtools-css:'

export default defineConfig([
  {
    name: 'dsh-cwtools/host',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    fixedExtension: false,
    deps: { neverBundle: isHostExternal },
    dts: false,
    clean: false,
  },
  {
    name: 'dsh-cwtools/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: (specifier: string) => clientExternal.has(specifier),
      alwaysBundle: (specifier: string) => !clientExternal.has(specifier),
    },
    inputOptions: {
      resolve: {
        conditionNames: ['production', 'browser', 'import', 'module', 'default'],
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [{
      name: 'dsh-cwtools-css-modules',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css') || importer === undefined) return null
        return cssPrefix + resolve(dirname(importer), source) + '.mjs'
      },
      async load(id: string) {
        if (!id.startsWith(cssPrefix)) return null
        const filename = id.slice(cssPrefix.length, -'.mjs'.length)
        this.addWatchFile(filename)
        const { code, exports } = transform({
          filename,
          code: await readFile(filename),
          cssModules: { pattern: 'cwtools-[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, value] of Object.entries(exports ?? {})) classMap[local] = value.name
        const tagId = 'dsh-cwtools/' + filename.split(/[\\/]/).pop()
        const selector = "document.querySelector('style[data-plugin-css=' + JSON.stringify(" + JSON.stringify(tagId) + ") + ']')"
        return [
          'const css = ' + JSON.stringify(code.toString()) + ';',
          'if (typeof document !== "undefined" && ' + selector + ' === null) {',
          '  const tag = document.createElement("style");',
          '  tag.dataset.plugin = "dsh-cwtools";',
          '  tag.dataset.pluginCss = ' + JSON.stringify(tagId) + ';',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          'export default ' + JSON.stringify(classMap) + ';',
        ].join('\n')
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-cwtools", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
