/**
 * dsh-ai-news — host half (AI search version)
 *
 * Five sections (LLM / Agent / AI creation trends / AI hot topics / AI short
 * drama "manju"), each refreshed ONLY when the user clicks the refresh button
 * (consumes tokens then, never otherwise). Per-item AI summaries are generated
 * on demand when the user expands an item, cached forever afterwards.
 *
 * Search goes through ctx.web (the same seam the built-in web_search tool
 * uses — DeepSeek-backed). Summary generation calls the DeepSeek
 * Anthropic-compatible Messages API directly, reusing DEEPSEEK_API_KEY.
 */

import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'

export const name = 'ai-news'
export const inject = ['web', 'webServer', 'tools', 'systemPrompt']

const SEARCH_TIMEOUT_MS = 20000
/** Concurrent search calls during one refresh (DeepSeek rate-limit safety). */
const SEARCH_CONCURRENCY = 6
const SUMMARY_MODEL = 'deepseek-v4-flash'
const SUMMARY_BASE_URL = 'https://api.deepseek.com/anthropic/v1'
const SUMMARY_MAX_TOKENS = 1024
const ANTHROPIC_VERSION = '2023-06-01'
const USER_AGENT = 'dsh-ai-news/2.0'

/**
 * Section definitions. Each section has a large query pool; a refresh draws a
 * random subset (perRefresh) so different refreshes surface different content
 * while keeping the cost per refresh bounded.
 */
const SECTION_DEFS = [
  {
    id: 'llm',
    label: '大语言模型',
    queries: [
      '最新大语言模型 发布 更新',
      'GPT Claude Gemini DeepSeek 新模型 发布',
      '开源大模型 Llama Qwen GLM 新版本',
      '热门 AI 工具 GitHub 开源项目',
      '大语言模型 评测 排行榜',
      '国产大模型 新发布',
      '多模态大模型 新进展',
      '大模型 推理能力 提升',
      '大模型 API 价格 更新',
      'AI 模型 上下文窗口 长文本',
    ],
    perRefresh: 4,
    perQuery: 8,
    maxItems: 15,
  },
  {
    id: 'agent',
    label: 'Agent',
    queries: [
      'AI Agent 智能体 最新进展',
      'Agent 框架 MCP 更新',
      '热门 AI 工具 新发布',
      'AI 智能体 工具 应用 新动态',
      'Agent 开发框架 新版本',
      '多智能体 协作 系统',
      'AI Agent 商业化 落地',
      '智能体 操作系统 新发布',
      'AI 编程助手 Agent 更新',
      'Agent 评测 基准',
    ],
    perRefresh: 4,
    perQuery: 8,
    maxItems: 15,
  },
  {
    id: 'creation',
    label: 'AI 内容创作趋势',
    queries: [
      'AI 内容创作 新趋势',
      'AI 生图 生视频 模型 新发布',
      'AI 视频生成 工具 更新',
      'AI 设计 多模态 创作 新工具',
      'AI 音乐 生成 新模型',
      'AI 3D 建模 生成',
      'AI 图像编辑 新工具',
      'AI 短视频 创作 工具',
      'AI 数字人 虚拟主播',
      'AI 内容 平台 新功能',
    ],
    perRefresh: 4,
    perQuery: 8,
    maxItems: 15,
  },
  {
    id: 'hot',
    label: 'AI 圈热点',
    queries: [
      'AI 大模型 热点 新闻',
      'AI 行业 最新动态 热点',
      '人工智能 模型 进展 新闻',
      'AI 融资 创业 新闻',
      'AI 政策 监管 新闻',
      'AI 大会 发布会 报道',
      'AI 芯片 算力 新闻',
      'AI 应用 落地 案例',
      'AI 研究 论文 突破',
      'AI 伦理 安全 争议',
    ],
    perRefresh: 4,
    perQuery: 8,
    maxItems: 15,
  },
  {
    id: 'manju',
    label: '漫剧',
    queries: [
      '红果 漫剧 排行榜',
      '抖音 漫剧 热播 AI 短剧',
      '快手 漫剧 AI 短剧 榜单',
      'AI 短剧 漫剧 行业 动态',
      '红果短剧 热榜 更新',
      '漫剧 爆款 分析',
      'AI 漫剧 创作 工具',
      '漫剧 市场 规模',
      '漫剧 出海 海外',
      '短剧 漫剧 观众 喜好',
    ],
    perRefresh: 4,
    perQuery: 8,
    maxItems: 15,
  },
]

const GUIDANCE = '本机已安装 dsh-ai-news 插件（AI 新闻与热点，AI 搜索版）：侧边栏「AI 新闻」入口。5 个板块：大语言模型、Agent、AI 内容创作趋势、AI 圈热点、漫剧。仅当用户点击「刷新」时才执行联网搜索（消耗 DeepSeek token）；每条热点可点击展开 AI 摘要（首次生成后缓存，不重复消耗）。用户提到「AI 新闻 / 模型动向 / 热点趋势 / 漫剧」时即指本插件。'

// ---------------------------------------------------------------- helpers

function stateDir() {
  return join(homedir(), '.dsh', 'plugins', 'dsh-ai-news')
}
function newsFile() {
  return join(stateDir(), 'news.json')
}
function summariesFile() {
  return join(stateDir(), 'summaries.json')
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, file)
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function isLoopback(req) {
  const addr = req.socket?.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 128 * 1024) return undefined
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

/** Resolve DEEPSEEK_API_KEY from the credentials service, then the file. */
async function resolveApiKey(ctx) {
  try {
    const credentials = ctx.get('credentials')
    if (credentials !== void 0) {
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (resolved?.value && String(resolved.value).length > 0) return String(resolved.value).trim()
    }
  } catch {
    /* fall through to file */
  }
  try {
    const text = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
    const m = text.match(/^DEEPSEEK_API_KEY\s*:\s*(.+)$/m)
    if (m && m[1].trim()) return m[1].trim()
  } catch {
    /* fall through */
  }
  throw new Error('未找到 DEEPSEEK_API_KEY（请在 DSH 凭据或 ~/.dsh/.credentials.yaml 中配置）')
}

// ---------------------------------------------------------------- search

/**
 * Selectable time windows. `days` is the backward window used for the
 * hard post-filter: results whose parsed publishedAt falls before the
 * cutoff are dropped so the dropdown actually means something.
 */
const TIME_WINDOWS = {
  day: { label: '今天', days: 0 },
  week: { label: '最近一周', days: 7 },
  month: { label: '最近一个月', days: 30 },
}

/** Build the query suffix: window label + today's concrete date. */
function timeSuffixFor(key) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  return ` ${TIME_WINDOWS[key].label} ${dateStr}`
}

/** Earliest allowed timestamp for a window (day start minus N days). */
function earliestFor(key) {
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return new Date(dayStart.getTime() - (TIME_WINDOWS[key]?.days ?? 30) * 86400000)
}

/** Parse a publishedAt value (ISO date or "N days/weeks/months ago"). */
function parsePublishedAt(value) {
  if (!value) return null
  const s = String(value).trim()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  const m = s.match(/(\d+)\s*(day|days|week|weeks|month|months|hour|hours)\s*ago/i)
  if (m) {
    const n = parseInt(m[1], 10)
    const unit = m[2].toLowerCase()
    const nowMs = Date.now()
    if (unit.startsWith('month')) return new Date(nowMs - n * 30 * 86400000)
    if (unit.startsWith('week')) return new Date(nowMs - n * 7 * 86400000)
    if (unit.startsWith('day')) return new Date(nowMs - n * 86400000)
    if (unit.startsWith('hour')) return new Date(nowMs - n * 3600000)
  }
  return null
}

/**
 * Hard time filter: keep items whose publishedAt is parseable and within the
 * window; items with no parseable timestamp are kept (cannot verify). Items
 * that are provably older than the window are dropped.
 */
function filterByWindow(items, key) {
  const earliest = earliestFor(key)
  return items.filter((item) => {
    const d = parsePublishedAt(item.publishedAt)
    if (d === null) return true
    return d >= earliest
  })
}

async function searchQuery(ctx, query, maxResults, timeSuffix) {
  const fullQuery = `${query}${timeSuffix}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
    const result = await ctx.web.search({ query: fullQuery, maxResults }, controller.signal)
    clearTimeout(timer)
    return (result.sources || []).map((s) => ({
      title: String(s.title || '').trim(),
      url: String(s.url || '').trim(),
      snippet: String(s.snippet || '').trim(),
      publishedAt: String(s.publishedAt || '').trim(),
    }))
  } catch (error) {
    console.warn(`[ai-news] search failed (${fullQuery}):`, error?.message ?? error)
    return []
  }
}

/** Run async tasks through a concurrency-bounded pool, preserving order. */
async function runPool(tasks, concurrency, fn) {
  const results = new Array(tasks.length)
  let index = 0
  const workers = []
  const count = Math.max(1, Math.min(concurrency, tasks.length))
  for (let i = 0; i < count; i++) {
    workers.push(
      (async () => {
        while (index < tasks.length) {
          const current = index++
          try {
            results[current] = await fn(tasks[current])
          } catch (error) {
            results[current] = { error }
          }
        }
      })(),
    )
  }
  await Promise.all(workers)
  return results
}

/**
 * Draw a random subset of queries for one section. Random each refresh so
 * consecutive refreshes surface different corners of the pool (and thus
 * different content) while keeping the per-refresh search count bounded.
 */
function pickQueries(def) {
  const pool = def.queries
  const count = Math.min(def.perRefresh ?? pool.length, pool.length)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

/**
 * Refresh every section concurrently: draw a random query subset per section,
 * run them through one bounded pool, then group + dedupe per section.
 * Total wall time is roughly (queries / concurrency) × one search, not
 * sections × queries × one search.
 */
async function refreshAll(ctx, windowKey) {
  const timeSuffix = timeSuffixFor(windowKey)
  const tasks = []
  for (const def of SECTION_DEFS) {
    for (const query of pickQueries(def)) {
      tasks.push({ def, query })
    }
  }
  const results = await runPool(tasks, SEARCH_CONCURRENCY, async (task) => ({
    def: task.def,
    items: await searchQuery(ctx, task.query, task.def.perQuery, timeSuffix),
  }))

  const sections = {}
  const seen = {}
  for (const def of SECTION_DEFS) {
    sections[def.id] = []
    seen[def.id] = new Set()
  }
  for (const result of results) {
    if (!result || !result.def) continue
    const def = result.def
    if (sections[def.id].length >= def.maxItems) continue
    const items = Array.isArray(result.items) ? result.items : []
    for (const item of items) {
      if (sections[def.id].length >= def.maxItems) break
      if (!item.url || seen[def.id].has(item.url)) continue
      seen[def.id].add(item.url)
      sections[def.id].push({ ...item, section: def.id })
    }
  }
  // Hard time filter: drop items provably older than the selected window.
  for (const def of SECTION_DEFS) {
    sections[def.id] = filterByWindow(sections[def.id], windowKey)
  }
  return sections
}

// ---------------------------------------------------------------- summary

/**
 * Generate an AI summary for one item via the DeepSeek Anthropic-compatible
 * Messages API. manju items additionally get reason (爆款原因) + takeaway
 * (值得借鉴). Result is cached by the caller.
 */
async function generateSummary(ctx, item) {
  const apiKey = await resolveApiKey(ctx)
  const isManju = item.manju === true
  const prompt = isManju
    ? `你是短剧行业分析师。请分析下面这条漫剧/短剧资讯，用中文输出一个 JSON 对象（不要输出任何其他文字），格式：
{"summary":"这条资讯讲了什么，概述不超过80字","reason":"爆款原因：为什么它会火，不超过100字","takeaway":"值得借鉴：对创作者或内容方向有什么启发，不超过100字"}

标题：${item.title}
内容摘要：${item.snippet || '（无摘要）'}
链接：${item.url}`
    : `你是 AI 领域资讯编辑。请用中文总结下面这条资讯，输出一个 JSON 对象（不要输出任何其他文字），格式：
{"summary":"这件事是什么、为什么值得关注，不超过120字"}

标题：${item.title}
内容摘要：${item.snippet || '（无摘要）'}
链接：${item.url}`

  const response = await fetch(`${SUMMARY_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      authorization: `Bearer ${apiKey}`,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const parsed = await response.json()
      detail = parsed?.error?.message ?? parsed?.message ?? detail
    } catch {
      /* keep detail */
    }
    throw new Error(`摘要生成失败: ${detail}`)
  }

  const data = await response.json()
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim()

  try {
    const parsed = JSON.parse(text)
    if (isManju) {
      return {
        summary: String(parsed.summary || text),
        reason: String(parsed.reason || ''),
        takeaway: String(parsed.takeaway || ''),
      }
    }
    return { summary: String(parsed.summary || text) }
  } catch {
    return isManju ? { summary: text } : { summary: text }
  }
}

// ---------------------------------------------------------------- plugin

export function apply(ctx) {
  mkdirSync(stateDir(), { recursive: true })

  const disposeSection = ctx.systemPrompt.section({
    name: 'plugin:dsh-ai-news',
    order: 160,
    text: GUIDANCE,
  })

  const getRoute = {
    kind: 'exact',
    path: '/api/ai-news',
    handler: async (req, res) => {
      if (!isLoopback(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      const data = readJson(newsFile(), null)
      writeJson(res, 200, {
        ok: true,
        fetchedAt: data?.fetchedAt ?? null,
        sections: data?.sections ?? {},
        summaries: readJson(summariesFile(), {}),
      })
    },
  }

  // Refresh runs in the background so the POST returns immediately; the
  // browser half polls GET /api/ai-news until fetchedAt changes. One refresh
  // at a time; a second click during a run reports "already running".
  let refreshRunning = false
  const refreshRoute = {
    kind: 'exact',
    path: '/api/ai-news/refresh',
    handler: async (req, res) => {
      if (!isLoopback(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if ((req.method ?? 'GET') !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      if (refreshRunning) {
        writeJson(res, 200, { ok: true, started: false, message: '刷新正在进行中' })
        return
      }
      refreshRunning = true
      const body = await readJsonBody(req)
      const windowKey = body?.window === 'day' || body?.window === 'week' ? body.window : 'month'
      void (async () => {
        try {
          const sections = await refreshAll(ctx, windowKey)
          const data = { fetchedAt: new Date().toISOString(), sections }
          writeJsonAtomic(newsFile(), data)
          console.log(`[ai-news] refresh complete (${windowKey}) at`, data.fetchedAt)
        } catch (error) {
          console.error('[ai-news] refresh failed:', error?.message ?? error)
        } finally {
          refreshRunning = false
        }
      })()
      writeJson(res, 200, { ok: true, started: true, message: '刷新已开始' })
    },
  }

  const summaryRoute = {
    kind: 'exact',
    path: '/api/ai-news/summary',
    handler: async (req, res) => {
      if (!isLoopback(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if ((req.method ?? 'GET') !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = await readJsonBody(req)
      const url = typeof body?.url === 'string' ? body.url : ''
      const title = typeof body?.title === 'string' ? body.title : ''
      const snippet = typeof body?.snippet === 'string' ? body.snippet : ''
      const manju = body?.manju === true
      if (!url || !title) {
        writeJson(res, 400, { ok: false, error: 'url and title are required' })
        return
      }
      try {
        const summaries = readJson(summariesFile(), {})
        if (summaries[url]) {
          writeJson(res, 200, { ok: true, cached: true, summary: summaries[url] })
          return
        }
        const summary = await generateSummary(ctx, { url, title, snippet, manju })
        summaries[url] = summary
        writeJsonAtomic(summariesFile(), summaries)
        writeJson(res, 200, { ok: true, cached: false, summary })
      } catch (error) {
        writeJson(res, 500, { ok: false, error: error?.message ?? String(error) })
      }
    },
  }

  const disposers = [getRoute, refreshRoute, summaryRoute].map((route) =>
    ctx.webServer.register(route),
  )

  ctx.effect(() => () => {
    disposeSection()
    for (const dispose of disposers) dispose()
  }, 'dsh-ai-news: routes')
}
