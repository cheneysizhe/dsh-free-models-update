// dsh-free-models-update v2.0.1 — 宿主侧（仅命令）
// 设置页「免费模型」已改为纯客户端（CORS 直连 + /api 的 settings/credentials），不再占用宿主路由。
// 此处只保留 /update-free-models 命令作为快捷刷新。
export const name = 'dsh-free-models-update'
export const inject = ['commands']

const MODELS_API = 'https://openrouter.ai/api/v1/models'
const CRED_REF = 'OPENROUTER_API_KEY'
const EXCLUDE_NAME = /content[\s-]*safety|moderation|classifier|embedding|rerank|re-ranker|similarity/i

function friendlyName(raw) {
  let n = String(raw || '')
    .replace(/\s*\(free\)\s*$/i, '')
    .replace(/\s*\(免费\)\s*$/, '')
    .trim()
  return n ? `${n} 免费` : ''
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
      modality: (m.architecture?.input_modalities?.length ?? 0) > 1 ? 'multimodal' : 'text',
      created: typeof m.created === 'number' ? m.created : undefined
    })
  }
  return models
}

export function apply(ctx) {
  ctx.commands.register({
    name: 'update-free-models',
    description: '一键更新 OpenRouter 免费模型清单（实时拉取 :free 模型写入配置）',
    handler: async () => {
      try {
        const models = await fetchFreeModels()
        if (models.length === 0) throw new Error('未获取到任何 :free 模型')
        const settings = ctx.get('settings')
        if (!settings) throw new Error('settings 服务不可用')
        await settings.mutate('llm-pi-ai', [
          { op: 'set', path: ['providers', 'openrouter', 'baseURL'], value: 'https://openrouter.ai/api/v1' },
          { op: 'set', path: ['providers', 'openrouter', 'api'], value: 'openai-completions' },
          { op: 'set', path: ['providers', 'openrouter', 'apiKeyEnv'], value: CRED_REF },
          { op: 'set', path: ['providers', 'openrouter', 'models'], value: models.map((m) => ({ id: m.id, name: m.name })) }
        ])
        return { kind: 'success', text: `已更新 ${models.length} 个 OpenRouter 免费模型：${models.map((m) => m.name).join('、')}` }
      } catch (error) {
        ctx.logger?.warn?.('dsh-free-models-update: %o', error)
        return { kind: 'error', text: `更新失败：${error instanceof Error ? error.message : String(error)}` }
      }
    }
  })
}
