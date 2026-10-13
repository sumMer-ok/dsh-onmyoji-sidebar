/**
 * Host half of dsh-onmyoji-sidebar: configuration, persistence, and progress
 * state for the sidebar tab.
 *
 * The loop itself stays in the conversation-driven tool. Every computer-use
 * observation is bound to an Agent Session, and an HTTP request from the
 * sidebar carries no initiator, so this half owns only what an agent-free
 * caller may change: the run parameters and the progress it reports.
 * @module dsh-onmyoji-sidebar
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const ROUTE = '/onmyoji-api'
const STORE = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'onmyoji-sidebar.json')

/** Bounds keep one panel entry from queueing an unbounded run. */
const LIMITS = {
  rounds: { min: 1, max: 999 },
  battlesPerRound: { min: 1, max: 50 },
  intervalMs: { min: 0, max: 3600000 },
}

const DEFAULTS = { rounds: 1, battlesPerRound: 5, intervalMs: 30000 }

export const inject = ['webServer']

/** Clamp one numeric field into its declared range, falling back to the default. */
function clamp(key, value) {
  const bounds = LIMITS[key]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULTS[key]
  return Math.min(bounds.max, Math.max(bounds.min, Math.trunc(numeric)))
}

function loadConfig() {
  try {
    const parsed = JSON.parse(readFileSync(STORE, 'utf8'))
    return {
      rounds: clamp('rounds', parsed.rounds),
      battlesPerRound: clamp('battlesPerRound', parsed.battlesPerRound),
      intervalMs: clamp('intervalMs', parsed.intervalMs),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function apply(ctx) {
  const state = {
    config: loadConfig(),
    running: false,
    round: 0,
    done: 0,
    total: 0,
    clicks: 0,
    store: STORE,
    log: [],
    error: null,
    updatedAt: null,
  }

  const note = (message) => {
    state.log.push({ at: Date.now(), message })
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200)
    state.updatedAt = Date.now()
  }

  const persist = () => {
    mkdirSync(dirname(STORE), { recursive: true })
    writeFileSync(STORE, JSON.stringify(state.config, null, 2))
  }

  const json = (res, status, body) => {
    const bytes = Buffer.from(JSON.stringify(body))
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(bytes)
  }

  const readBody = (req) => new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += String(chunk) })
    req.on('end', () => {
      try { resolve(JSON.parse(raw === '' ? '{}' : raw)) } catch { resolve({}) }
    })
  })

  note('面板已就绪，参数存于 ' + STORE)

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      if (req.headers['sec-fetch-site'] === 'cross-site') {
        return json(res, 403, { ok: false, error: 'cross-site request rejected' })
      }
      const action = new URL(req.url, 'http://127.0.0.1').pathname.slice(ROUTE.length) || '/'
      if (action === '/status') return json(res, 200, { ok: true, result: state })
      if (action === '/config' && req.method === 'POST') {
        const body = await readBody(req)
        state.config = {
          rounds: clamp('rounds', body.rounds),
          battlesPerRound: clamp('battlesPerRound', body.battlesPerRound),
          intervalMs: clamp('intervalMs', body.intervalMs),
        }
        state.total = state.config.rounds * state.config.battlesPerRound
        persist()
        note('参数已保存：' + state.config.rounds + ' 轮 × ' + state.config.battlesPerRound
          + ' 场，轮间隔 ' + Math.round(state.config.intervalMs / 1000) + ' 秒')
        return json(res, 200, { ok: true, result: state })
      }
      if (action === '/report' && req.method === 'POST') {
        const body = await readBody(req)
        if (typeof body.round === 'number') state.round = body.round
        if (typeof body.done === 'number') state.done = body.done
        if (typeof body.clicks === 'number') state.clicks = body.clicks
        if (typeof body.total === 'number') state.total = body.total
        if (typeof body.running === 'boolean') state.running = body.running
        if (typeof body.message === 'string' && body.message !== '') note(body.message)
        if (body.error === null || typeof body.error === 'string') state.error = body.error
        return json(res, 200, { ok: true, result: state })
      }
      return json(res, 404, { ok: false, error: 'unknown action' })
    },
  }), 'onmyoji-sidebar: panel route')
}
