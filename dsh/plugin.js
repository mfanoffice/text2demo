/**
 * 演示动画工作台 · 服务端入口
 *
 * 只做两件事，业务数据一律不落盘：
 *   1. 把工作台的静态界面（单文件 HTML + 三个引擎脚本）从本机接口发出去；
 *   2. 提供一条受限转发接口，让面板里的工作台能调用用户自己配置的模型接口。
 *      这条接口有两种模式：默认「收完再吐」（一次性 JSON），以及 payload.stream
 *      为真时的「逐块透传」。分镜这类长请求必须走后者——见下面流式分支的注释。
 *
 * 为什么需要转发：工作台面板运行在 Harness 的页面里（http 源），浏览器直连模型
 * 接口会受跨域限制；而不少厂商（尤其自建网关）根本不返回 CORS 头。转发后所有
 * 请求都同源，跨域问题消失。密钥只随请求经过本进程，不写盘、不打日志。
 *
 * 注意：connection.fetch 的路径必须是**精确路径**，每段只允许 [A-Za-z0-9_$.-]，
 * 不支持 :param 占位符（宿主会以 "invalid exact Fetch route" 拒绝整条插件）。
 * 所以这里是"一个文件一条路由"的白名单，而不是通配路由。
 */
import Schema from '@deepseek-ai/schemastery'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'deck-workbench'
export const inject = ['connection']
/** 本工作台的业务数据都在浏览器 localStorage 里，服务端不需要数据目录。 */
export const Config = Schema.object({})

const PREFIX = '/api/deck-workbench'
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
/** 端点 → 包内文件。写死映射，既满足精确路径要求，也天然没有路径穿越。 */
const ASSET_ROUTES = {
  app: 'workbench.html',
  'tools/ai.js': 'tools/ai.js',
  'tools/deck-engine.js': 'tools/deck-engine.js',
  'tools/cover-render.js': 'tools/cover-render.js'
}
/** 注入给工作台的内嵌标记：它据此把出网请求改走本机转发。 */
const EMBED_FLAG = `<script>window.__KN_EMBED__={proxy:${JSON.stringify(PREFIX)}}</script>`
/** 允许转发的上游路径：只放行这三类模型接口，不做通用代理。 */
const FORWARD_PATHS = ['/chat/completions', '/models', '/images/generations']
const FORWARD_HEADERS = ['authorization', 'content-type', 'accept']
/* 文生图（OpenAI Image 兼容）回来的 base64 可能几 MB，正文上限太小会把 JSON 截断 */
const MAX_TEXT = 32 * 1024 * 1024
const MAX_TIMEOUT = 600000
/* 流式请求看的是「静默时长」而不是「总时长」：只要上游还在吐字就不算超时 */
const IDLE_MIN = 10000
const IDLE_MAX = 600000

const noStore = { 'cache-control': 'no-store' }
const badRequest = (message) => Response.json({ error: message }, { status: 400, headers: noStore })

/** 校验上游地址：必须是 http/https，且落在允许的模型接口路径上。 */
function checkUpstream(value) {
  let url
  try { url = new URL(String(value ?? '')) } catch { throw new Error('接口地址不是合法 URL') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('接口地址必须是 http 或 https')
  if (!FORWARD_PATHS.some((suffix) => url.pathname.replace(/\/+$/, '').endsWith(suffix))) {
    throw new Error('只转发 /chat/completions、/models、/images/generations 三类接口')
  }
  return url
}

function pickHeaders(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw)) {
    if (FORWARD_HEADERS.includes(String(key).toLowerCase()) && typeof value === 'string') out[key] = value
  }
  return out
}

async function readJson(request) {
  const text = await request.text()
  if (!text) return {}
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('请求体必须是 JSON 对象')
  return parsed
}

export function apply(ctx, config) {
  for (const [endpoint, file] of Object.entries(ASSET_ROUTES)) {
    const isHtml = file.endsWith('.html')
    ctx.connection.fetch.register({
      path: `${PREFIX}/${endpoint}`,
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch() {
        try {
          let body = await readFile(join(ASSETS, file), 'utf8')
          if (isHtml) body = body.replace(/<head([^>]*)>/i, (tag) => tag + EMBED_FLAG)
          return new Response(body, {
            headers: {
              'content-type': isHtml ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
              ...noStore
            }
          })
        } catch (error) {
          return Response.json({ error: `读不到 ${file}：${error.message}` }, { status: 500, headers: noStore })
        }
      }
    })
  }

  ctx.connection.fetch.register({
    path: `${PREFIX}/forward`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      let payload
      try { payload = await readJson(request) } catch (error) { return badRequest(error.message) }

      let url
      try { url = checkUpstream(payload.url) } catch (error) { return badRequest(error.message) }

      const method = String(payload.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') return badRequest('只支持 GET 与 POST')

      /* 流式分支：把上游的字节原样、不断地交给浏览器。
         非流式的老路是「收完再吐」（await upstream.text()），这会毁掉流式的意义：
         只要这里缓冲，浏览器端就仍在等一个完整响应，静默超时照样开火。
         所以流式必须逐块透传，并且超时从「总时长」改成「静默时长」。 */
      if (payload.stream === true) {
        /* 比浏览器端多给 5 秒宽限：让浏览器端的静默超时先开火，它报的错更好读
           （「上游 N 秒没有发出任何字节」），这里的看门狗只是浏览器已经走了之后的兜底。 */
        const asked = Number(payload.idleTimeout) || 0
        const idleMs = Math.min(Math.max(asked + 5000, IDLE_MIN), IDLE_MAX)
        let upstream
        try {
          upstream = await fetch(url, {
            method,
            headers: pickHeaders(payload.headers),
            body: method === 'POST' && payload.body != null ? String(payload.body) : undefined,
            redirect: 'follow'
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: `连不上上游接口：${error.message}` }), {
            status: 502, headers: { 'content-type': 'application/json', ...noStore }
          })
        }
        /* 流式模式一律裸透传，不套 {status,text} 信封：状态码就是状态码，
           正文就是上游的正文。客户端因此能用同一套逻辑处理 401/429/5xx。 */
        if (!upstream.ok || !upstream.body) {
          return new Response((await upstream.text()).slice(0, MAX_TEXT), {
            status: upstream.status,
            headers: {
              'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
              ...noStore
            }
          })
        }
        const reader = upstream.body.getReader()
        let idle
        const body = new ReadableStream({
          start(controller) {
            const rearm = () => {
              clearTimeout(idle)
              // 看门狗：静默太久说明上游已经不吐字了，主动断开，别让浏览器白等
              idle = setTimeout(() => {
                try { controller.error(new Error('上游静默超时')) } catch {}
                reader.cancel().catch(() => {})
              }, idleMs)
            }
            const pump = () => {
              reader.read().then(({ done, value }) => {
                if (done) { clearTimeout(idle); try { controller.close() } catch {}; return }
                rearm()
                controller.enqueue(value)
                pump()
              }, (error) => {
                clearTimeout(idle)
                try { controller.error(error) } catch {}
              })
            }
            rearm()
            pump()
          },
          cancel(reason) {                       // 浏览器断开时，一起掐掉上游连接
            clearTimeout(idle)
            return reader.cancel(reason)
          }
        })
        return new Response(body, {
          status: upstream.status,
          headers: {
            'content-type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
            'cache-control': 'no-store',
            'x-accel-buffering': 'no'
          }
        })
      }

      const timeout = Math.min(Math.max(Number(payload.timeout) || 120000, 1000), MAX_TIMEOUT)

      try {
        const upstream = await fetch(url, {
          method,
          headers: pickHeaders(payload.headers),
          body: method === 'POST' && payload.body != null ? String(payload.body) : undefined,
          signal: AbortSignal.timeout(timeout),
          redirect: 'follow'
        })
        const body = (await upstream.text()).slice(0, MAX_TEXT)
        // 上游状态码原样交回浏览器端，让工作台沿用它自己的诊断逻辑（401/404/…）。
        return Response.json({ status: upstream.status, text: body }, { headers: noStore })
      } catch (error) {
        const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
        return Response.json({
          status: timedOut ? 504 : 502,
          text: JSON.stringify({ error: timedOut ? '上游接口超时' : `连不上上游接口：${error.message}` })
        }, { headers: noStore })
      }
    }
  })
}
