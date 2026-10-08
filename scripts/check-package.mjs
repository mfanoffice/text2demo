/**
 * 工作台包自检：把《工作台开发规范》第 3 节的“必须/建议”项逐条量一遍。
 * 本机没有 scripts/check-workbench-package.mjs（宿主未随附），所以这份自检脚本
 * 由本包自己提供，跑法：node scripts/check-package.mjs
 *
 * 只读检查，不改文件、不联网。
 */
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []
const ok = []
const say = (list, text) => list.push(text)
const exists = async (rel) => { try { await stat(join(ROOT, rel)); return true } catch { return false } }

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))

/* ---- 3.2 package.json 必须项 ---- */
if (!pkg.name) say(problems, 'package.json 缺 name')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(pkg.version))) say(problems, `version 不是完整 SemVer：${pkg.version}`)
else say(ok, `name=${pkg.name} version=${pkg.version}`)
if (pkg.type !== 'module') say(notes, 'type 不是 module（建议项）')
else say(ok, 'type=module')

const serverEntry = typeof pkg.exports?.['.'] === 'string' ? pkg.exports['.'] : pkg.exports?.['.']?.default
if (!serverEntry) say(problems, 'exports["."] 缺失（必须）')
else if (!(await exists(serverEntry))) say(problems, `exports["."] 指向的文件不存在：${serverEntry}`)
else say(ok, `服务端入口 ${serverEntry}`)
if (pkg.main !== serverEntry) say(notes, `main(${pkg.main}) 与 exports["."](${serverEntry}) 不一致`)
if (serverEntry && !/^\.\/dsh\/[\w.-]+\.js$/.test(serverEntry)) say(notes, `服务端入口不在 dsh/ 目录下：${serverEntry}`)

const patch = pkg.dsh?.bundle?.patch
if (!patch) say(problems, 'dsh.bundle.patch 缺失（没有它只会被当作普通依赖安装）')
else if (!(await exists(patch))) say(problems, `dsh.bundle.patch 指向的文件不存在：${patch}`)
else {
  const raw = await readFile(join(ROOT, patch), 'utf8')
  const body = raw.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#')).join('\n')
  if (!body.trim()) say(problems, 'cordis.patch.yml 是空文件或只有注释（会导致启动失败）')
  else {
    if (!/^\s*-\s*insert:/m.test(body)) say(problems, 'cordis.patch.yml 里没有 insert 条目')
    const name = /name:\s*['"]?([^'"\s]+)['"]?/.exec(body)?.[1]
    if (name !== pkg.name) say(problems, `cordis.patch.yml 的 name(${name}) 必须写 npm 包名(${pkg.name})`)
    else say(ok, `cordis.patch.yml insert → id/name 指向 ${name}`)
    if (/^\s*-\s*(id|insert):/m.test(body) === false) say(notes, 'patch 结构不是预期的顶层数组')
  }
}

const platform = pkg.dsh?.client?.platform
if (platform !== 'web') say(problems, `dsh.client.platform 必须是 "web"，现在是 ${platform}`)
else say(ok, 'dsh.client.platform=web')
const inject = pkg.dsh?.client?.inject
if (!Array.isArray(inject) || !inject.includes('dsh-desktop-workbenches')) {
  say(problems, 'dsh.client.inject 必须包含 "dsh-desktop-workbenches"')
} else say(ok, `dsh.client.inject=${inject.join(', ')}`)

const clientEntry = typeof pkg.exports?.['./client'] === 'string' ? pkg.exports['./client'] : pkg.exports?.['./client']?.default
if (!clientEntry) say(problems, '声明了 dsh.client 就必须导出 exports["./client"]')
else if (!(await exists(clientEntry))) say(problems, `exports["./client"] 指向的文件不存在：${clientEntry}`)
else {
  const code = await readFile(join(ROOT, clientEntry), 'utf8')
  const id = /__ModuleLoader__\.load\(\{\s*id:\s*['"]([^'"]+)['"]/.exec(code)?.[1]
  if (!id) say(problems, '客户端入口没有 window.__ModuleLoader__.load({ id, factory })')
  else if (id !== pkg.name) say(problems, `客户端模块 id(${id}) 必须与包名(${pkg.name})一致`)
  else say(ok, `客户端模块 id=${id}`)
  if (!/ctx\.desktopWorkbenches\.register\(/.test(code)) say(problems, '客户端没有调用 ctx.desktopWorkbenches.register()')
  if (!/repository:\s*'https:\/\/github\.com\/[^']+'/.test(code)) say(problems, 'register() 没有提供规范的 GitHub repository URL')
  else say(ok, 'register() 提供 repository / title / 业务组件')
  if (/register\(\{[^}]*\bid:\s*['"]/.test(code)) say(notes, '新包不应填写 register({ id })')
}

for (const field of ['license', 'author', 'description']) if (!pkg[field]) say(notes, `${field} 建议真实填写`)
const hostPeers = Object.keys(pkg.peerDependencies || {}).filter((name) => name.startsWith('@deepseek-ai/'))
if (!hostPeers.length) say(notes, '建议把 @deepseek-ai/* 宿主包写进 peerDependencies')
else say(ok, `peerDependencies 宿主包 ${hostPeers.length} 个，且已标 optional（不落进 dependencies）`)
for (const name of hostPeers) {
  if (!/@deepseek-ai\//.test(name)) continue
  if (String(pkg.peerDependencies[name]).includes('-rc.') || String(pkg.peerDependencies[name]).includes('-alpha.')) say(ok, `${name} 版本范围含预发布分支`)
}
if (Object.keys(pkg.dependencies || {}).some((n) => n.startsWith('@deepseek-ai/'))) say(problems, '宿主包不能写进 dependencies（会装第二份宿主代码）')

/* ---- files 必须覆盖入口与资源 ---- */
const files = pkg.files || []
const need = [patch, serverEntry, clientEntry].filter(Boolean).map((p) => String(p).replace(/^\.\//, ''))
for (const rel of need) {
  const top = rel.split('/')[0]
  if (!files.includes(top)) say(problems, `files 没包含 ${top}（打包会漏掉入口）`)
}
if (!files.includes('assets')) say(problems, 'files 没包含 assets')

/* ---- 资源与内容检查 ---- */
if (!(await exists('assets/workbench.html'))) say(problems, 'assets/workbench.html 不存在，先跑 node scripts/build-assets.mjs')
else {
  const html = await readFile(join(ROOT, 'assets/workbench.html'), 'utf8')
  // 只认静态标签里的引用；JS 拼接出来的 src（'<img src="' + png + '"'）不算
  const refs = [...html.matchAll(/src="([^"'+<>\s]+)"/g)].map((m) => m[1])
  for (const ref of refs) {
    if (/^https?:/.test(ref)) say(problems, `界面引用了外部脚本（规范要求零外部依赖）：${ref}`)
    // 去掉 ?v= 缓存尾巴再核对文件：尾巴只是为了逼浏览器重新取，不是文件名的一部分
    else if (!(await exists(join('assets', ref.split('?')[0])))) say(problems, `界面引用的资源不在包里：assets/${ref}`)
  }
  say(ok, `assets/workbench.html 引用 ${refs.length} 个本地脚本，均随包分发`)
  if (!/window\.__KN_EMBED__/.test(await readFile(join(ROOT, serverEntry), 'utf8'))) say(notes, '服务端没有注入 __KN_EMBED__ 标记')
}

const secretPatterns = [
  [/sk-[A-Za-z0-9]{16,}/, '疑似 OpenAI 风格密钥'],
  [/Bearer\s+ey[A-Za-z0-9._-]{20,}/, '疑似硬编码 token'],
  [/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9._-]{16,}['"]/i, '疑似硬编码 api key']
]
for (const rel of ['assets/workbench.html', 'assets/tools/ai.js', serverEntry, clientEntry]) {
  if (!(await exists(rel))) continue
  const text = await readFile(join(ROOT, rel), 'utf8')
  for (const [re, what] of secretPatterns) if (re.test(text)) say(problems, `${rel} 里有${what}`)
}

/* 引擎版本自证链：workbench.html 的期望值、三个 ?v= 尾巴、ai.js 报的版本、包版本必须一致。
   这几处一旦漂掉，缓存混用就再也发现不了（面板里看不出，页面也不吭声）。 */
{
  const page = await readFile(join(ROOT, 'assets/workbench.html'), 'utf8')
  const ai = await readFile(join(ROOT, 'assets/tools/ai.js'), 'utf8')
  const reported = (ai.match(/KN_AI_VERSION\s*=\s*'([^']+)'/) || [])[1]
  const expected = (page.match(/var EXPECT = '([^']+)'/) || [])[1]
  const tags = [...page.matchAll(/tools\/[a-z-]+\.js\?v=([^"']+)/g)].map((m) => m[1])
  if (!reported || !expected) problems.push('引擎版本自证缺失：workbench.html 的 EXPECT 或 ai.js 的 KN_AI_VERSION 找不到')
  else if (reported !== expected) problems.push(`引擎版本不一致：ai.js 报 ${reported}，页面期望 ${expected}`)
  else if (tags.length !== 3 || tags.some((v) => v !== expected)) problems.push(`脚本 ?v= 尾巴与引擎版本对不上：${tags.join(' / ') || '（没有）'} vs ${expected}`)
  else if (pkg.version !== expected) problems.push(`引擎版本与包版本不一致：包 ${pkg.version}，引擎自证 ${expected}（四处要一起改）`)
  else ok.push(`引擎版本自证一致：${expected}（包版本 + ai.js + 页面 EXPECT + 3 个 ?v= 尾巴）`)
}

/* HTML 结构完整性：<script> 与 </script> 必须成对。少一个开标签的后果极其隐蔽——
   它后面整个内联脚本会掉到标签外，被浏览器当正文渲染，面板上就是一大段 JS 源码
   （1.0.4 真发生过：插入新代码时把内联脚本的 <script> 吃掉了）。 */
{
  const page = await readFile(join(ROOT, 'assets/workbench.html'), 'utf8')
  const opens = (page.match(/<script\b/g) || []).length
  const closes = (page.match(/<\/script>/g) || []).length
  if (opens !== closes) {
    problems.push(`workbench.html 的 <script> 不成对：${opens} 个开标签 vs ${closes} 个闭标签——内联脚本可能掉到标签外，会被当正文渲染出来`)
  } else if (opens === 0) {
    problems.push('workbench.html 里一个 <script> 都没有')
  } else {
    ok.push(`workbench.html 的 <script> 成对：${opens} 开 / ${closes} 闭`)
  }
}

/* ---- 输出 ---- */
const line = (label, list) => list.forEach((item) => process.stdout.write(`${label} ${item}\n`))
process.stdout.write(`\n工作台包自检：${pkg.name}@${pkg.version}（${ROOT}）\n`)
line('  ✓', ok)
line('  ·', notes)
line('  ✗', problems)
process.stdout.write(problems.length ? `\n结论：${problems.length} 项必须项不通过\n` : '\n结论：必须项全部通过\n')
process.exitCode = problems.length ? 1 : 0
