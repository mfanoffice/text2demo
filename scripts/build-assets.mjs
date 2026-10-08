/**
 * 构建 assets：把工作台界面与三个引擎脚本从源码目录复制进本包。
 *
 * 工作台的源码只有一份（keynote-workbench/），本包不自带副本，
 * 避免两边各改一份慢慢跑偏。改完源码后重新打包即可。
 *
 * 用法：node scripts/build-assets.mjs [源码目录]
 *   默认源码目录：包目录同级的 keynote-workbench/
 *   可用环境变量 KN_SOURCE 覆盖。
 */
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const OUT = join(ROOT, 'assets')
const SOURCE = resolve(process.argv[2] || process.env.KN_SOURCE || join(ROOT, '..', 'keynote-workbench'))

/** 只带这三样进包：界面、引擎、封面渲染；不含示例产物与快照。 */
const ENGINE_FILES = ['ai.js', 'deck-engine.js', 'cover-render.js']

async function must(path, what) {
  try { await stat(path) } catch { throw new Error(`找不到${what}：${path}`) }
  return path
}

async function main() {
  await must(join(SOURCE, 'workbench.html'), '工作台界面')
  for (const file of ENGINE_FILES) await must(join(SOURCE, 'tools', file), `引擎脚本 ${file}`)

  await rm(OUT, { recursive: true, force: true })
  await mkdir(join(OUT, 'tools'), { recursive: true })

  const html = await readFile(join(SOURCE, 'workbench.html'), 'utf8')
  if (!html.includes('tools/deck-engine.js')) throw new Error('工作台界面没有引用 tools/deck-engine.js，相对路径可能变了')
  if (/\.\.\/\.\.\/tools\//.test(html)) throw new Error('界面里还留着上一层的 tools/ 相对路径')
  await cp(join(SOURCE, 'workbench.html'), join(OUT, 'workbench.html'))
  for (const file of ENGINE_FILES) await cp(join(SOURCE, 'tools', file), join(OUT, 'tools', file))

  const copied = await readdir(join(OUT, 'tools'))
  process.stdout.write(`assets 已从 ${SOURCE} 重建：workbench.html + ${copied.sort().join(' / ')}\n`)
}

await main()
