import path from 'node:path'
export default ({
  root: path.resolve('tests/ui'),
  base: './',
  build: { outDir: path.resolve('artifacts/ui/workbench-component'), emptyOutDir: true, rollupOptions: { input: { workbench: path.resolve('tests/ui/workbench-preview.html'), actual: path.resolve('tests/ui/actual-gui-preview.html'), galaxy: path.resolve('tests/ui/galaxy-preview.html') } } },
})