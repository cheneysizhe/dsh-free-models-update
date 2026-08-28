// dsh-free-models-update v2 — OpenRouter 免费模型管理（宿主侧）
// 官方插件形态：export { name, inject, apply }（cordis 对象插件）
// 能力：
//   1. 命令 /update-free-models —— 一键更新免费模型清单
//   2. webServer 路由 /free-models-update/* —— 供设置页「免费模型」调用：
//      GET  /state   读取 Key 状态 + 当前模型清单
//      POST /refresh 拉取实时 :free 模型并写入 llm-pi-ai 配置
//      POST /test    用你的 Key 校验 + 真实调用一个免费模型
//      POST /key     保存你的 OpenRouter Key（走 credentials 通道）
// 安全：路由仅接受回环地址 + 同源浏览器请求（与官方 isTrustedApiRequest 同规则）
export const name = 'dsh-free-models-update'
export const inject = ['commands', 'webServer']

const MODELS_API = 'https://openrouter.ai/api/v1/models'
const KEY_API = 'https://openrouter.ai/api/v1/key'
const CHAT_API = 'https://openrouter.ai/api/v1/chat/completions'
const TEST_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'
const CRED_REF = 'OPENROUTER_API_KEY'
const ROUTE = '/free-models-update'
const MAX_BODY = 64 * 1024
// 不适合作聊天/对话的免费模型（分类器/安全/向量等）
const EXCLUDE_NAME = /content[\s-]*safety|moderation|classifier|embedding|rerank|re-ranker|similarity/i

function friendlyName(raw) {
  let n = String(raw || '')
    .replace(/\s*\(free\)\s*$/i, '')
    .replace(/\s*\(免费\)\s*$/, '')
    .trim()
  return n ? `${n} 免费` : ''
}

function modalityLabel(modalities) {
  const m = Array.isArray(modalities) ? modalities : []
  return m.length > 1 ? 'multimodal' : 'text'
}

async function fetchFreeModels() {
  const res = await fetch(MODELS_API, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`OpenRouter 接口返回 HTTP ${res.status}`)
  const data = await res.json()
  const list = (data.data || []).filter((m) => {
    const id = String(m.id || '')
    const name = String(m.name || id)
    return id.endsWith(':free') && !EXCLUDE_NAME.test(name)
  })
  const seen = new Set()
  const models = []
  for (const m of list) {
    const id = String(m.id)
    if (seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      name: friendlyName(m.name) || id,
      modality: modalityLabel(m.architecture?.input_modalities),
      created: typeof m.created === 'number' ? m.created : undefined,
      contextWindow: typeof m.context_length === 'number' ? m.context_length : undefined
    })
  }
  return models
}

function isLoopbackHostname(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
}

/** 与官方 isTrustedApiRequest 同规则：回环 Host + 非跨站 + Origin 同源（无 Origin 放行）。 */
function trusted(req) {
  const host = String(req.headers?.host || '').toLowerCase()
  const hostname = host.split(':')[0]
  if (!isLoopbackHostname(hostname)) return false
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin === undefined || origin === '') return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function apply(ctx) {
  let lastUpdated = null
  let lastModels = []

  async function refreshModels() {
    const models = await fetchFreeModels()
    if (models.length === 0) throw new Error('未获取到任何 :free 模型，已放弃写入')
    const settings = ctx.get('settings')
    if (!settings) throw new Error('settings 服务不可用')
    await settings.mutate('llm-pi-ai', [
      { op: 'set', path: ['providers', 'openrouter', 'baseURL'], value: 'https://openrouter.ai/api/v1' },
      { op: 'set', path: ['providers', 'openrouter', 'api'], value: 'openai-completions' },
      { op: 'set', path: ['providers', 'openrouter', 'apiKeyEnv'], value: CRED_REF },
      { op: 'set', path: ['providers', 'openrouter', 'models'], value: models.map((m) => ({ id: m.id, name: m.name })) }
    ])
    lastUpdated = new Date().toISOString()
    lastModels = models
    return models
  }

  async function keyStatus() {
    const creds = ctx.get('credentials')
    if (!creds) return { configured: false }
    try {
      const d = await creds.describe(CRED_REF)
      return { configured: !!d?.configured, source: d?.source ?? null }
    } catch {
      return { configured: false }
    }
  }

  function modelsFromSettings() {
    try {
      const desc = (ctx.get('settings')?.describe({ redactSecrets: true }) ?? []).find((d) => d.ns === 'llm-pi-ai')
      const listed = desc?.value?.providers?.openrouter?.models
      if (Array.isArray(listed)) return listed.map((m) => ({ id: m.id, name: m.name ?? m.id }))
    } catch { /* fall through */ }
    return []
  }

  // 命令：/update-free-models
  ctx.commands.register({
    name: 'update-free-models',
    description: '一键更新 OpenRouter 免费模型清单（实时拉取 :free 模型写入配置，热加载生效）',
    handler: async () => {
      try {
        const models = await refreshModels()
        return {
          kind: 'success',
          text: `已更新 ${models.length} 个 OpenRouter 免费模型：${models.map((m) => m.name).join('、')}`
        }
      } catch (error) {
        ctx.logger?.warn?.('dsh-free-models-update: %o', error)
        return { kind: 'error', text: `更新失败：${error instanceof Error ? error.message : String(error)}` }
      }
    }
  })

  // 设置页路由
  ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      try {
        if (!trusted(req)) return sendJson(res, 403, { error: 'forbidden' })
        const pathname = new URL(req.url ?? '/', 'http://x').pathname

        if (req.method === 'GET' && pathname === `${ROUTE}/state`) {
          const ks = await keyStatus()
          const models = lastModels.length > 0 ? lastModels : modelsFromSettings()
          return sendJson(res, 200, {
            ok: true,
            keyConfigured: ks.configured,
            keySource: ks.source,
            lastUpdated,
            models,
            count: models.length
          })
        }

        if (req.method === 'POST' && pathname === `${ROUTE}/refresh`) {
          const models = await refreshModels()
          return sendJson(res, 200, { ok: true, lastUpdated, models, count: models.length })
        }

        if (req.method === 'POST' && pathname === `${ROUTE}/test`) {
          const creds = ctx.get('credentials')
          const r = creds ? await creds.resolve(CRED_REF) : undefined
          const key = r?.value
          if (!key) return sendJson(res, 200, { ok: false, error: '尚未配置 OPENROUTER_API_KEY' })
          let keyInfo = null
          try {
            const kr = await fetch(KEY_API, { headers: { authorization: `Bearer ${key}` } })
            keyInfo = kr.ok ? await kr.json() : { error: `HTTP ${kr.status}` }
          } catch (error) {
            keyInfo = { error: error instanceof Error ? error.message : String(error) }
          }
          const data = keyInfo?.data
          let sample = ''
          let modelUsed = ''
          try {
            const cr = await fetch(CHAT_API, {
              method: 'POST',
              headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
              body: JSON.stringify({
                model: TEST_MODEL,
                messages: [{ role: 'user', content: '只回复两个字：成功' }],
                max_tokens: 16
              })
            })
            if (cr.ok) {
              const cd = await cr.json()
              sample = cd.choices?.[0]?.message?.content ?? ''
              modelUsed = cd.model ?? TEST_MODEL
            } else {
              sample = `HTTP ${cr.status}`
            }
          } catch (error) {
            sample = `异常：${error instanceof Error ? error.message : String(error)}`
          }
          return sendJson(res, 200, {
            ok: true,
            keyValid: !!data && !data.error,
            freeTier: !!data?.is_free_tier,
            usage: data?.usage ?? null,
            keyError: keyInfo?.error ?? null,
            test: { model: TEST_MODEL, modelUsed, response: sample }
          })
        }

        if (req.method === 'POST' && pathname === `${ROUTE}/key`) {
          let body
          try {
            body = JSON.parse((await readBody(req)) || '{}')
          } catch {
            return sendJson(res, 400, { error: '无效的 JSON' })
          }
          const key = String(body.key ?? '').trim()
          if (!key) return sendJson(res, 400, { error: 'key 不能为空' })
          if (!/^[\x21-\x7E]+$/.test(key)) return sendJson(res, 400, { error: 'key 含非法字符（仅可打印 ASCII）' })
          const creds = ctx.get('credentials')
          if (!creds) return sendJson(res, 500, { error: 'credentials 服务不可用' })
          await creds.set(CRED_REF, key)
          return sendJson(res, 200, { ok: true })
        }

        return sendJson(res, 404, { error: 'not found' })
      } catch (error) {
        ctx.logger?.warn?.('dsh-free-models-update: %o', error)
        return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    }
  })
}
