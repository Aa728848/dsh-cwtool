import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const args = new Map(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith('--')) return []
  return [value.slice(2), all[index + 1]?.startsWith('--') ? true : all[index + 1] ?? true]
}))
const phase = args.get('phase') ?? 'before'
const viewportName = args.get('viewport') ?? 'desktop'
const section = args.get('section') === 'cwtools'
const viewport = viewportName === 'narrow'
  ? { width: 390, height: 844 }
  : { width: 1280, height: 900 }
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const cdpUrl = process.env.DSH_CDP_URL
const profileDir = process.env.CHROME_USER_DATA_DIR
let browser
let context
if (cdpUrl) {
  browser = await chromium.connectOverCDP(cdpUrl)
  context = browser.contexts()[0]
} else if (profileDir) {
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath, headless: true, viewport, colorScheme: 'dark', locale: 'zh-CN',
  })
} else {
  browser = await chromium.launch({ executablePath, headless: true })
  context = await browser.newContext({ viewport, colorScheme: 'dark', locale: 'zh-CN' })
}
try {
  const page = context.pages()[0] ?? await context.newPage()
  await page.setViewportSize(viewport)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(process.env.DSH_URL ?? 'http://127.0.0.1:3080', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '账号菜单' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '账号菜单' }).click()
  await page.getByRole('menuitem').filter({ hasText: /^设置$/ }).first().click()
  await page.getByRole('button', { name: '打开配置文件' }).waitFor({ state: 'visible' })
  if (section) {
    await page.getByRole('button', { name: 'CWTools', exact: true }).click()
  }
  await page.evaluate(() => document.fonts.ready)
  const output = path.resolve('artifacts', 'ui', phase + '-' + viewportName + '.png')
  await mkdir(path.dirname(output), { recursive: true })
  await page.screenshot({ path: output, fullPage: false })
  console.log(JSON.stringify({ output, viewport, colorScheme: 'dark', section: section ? 'cwtools' : 'account' }))
} finally {
  if (browser) await browser.close()
  else await context.close()
}
