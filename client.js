/**
 * Browser half of dsh-onmyoji-sidebar. It follows the shipped module shape: the
 * factory fills module.exports, tags it as a module namespace, and attaches
 * apply/inject, because the loader dispatches on those exports.
 */
window.__ModuleLoader__.load({
	id: 'dsh-onmyoji-sidebar',
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		var react = require('react')

		var FIELD = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }
		var LABEL = { fontSize: 12, opacity: 0.75 }
		var INPUT = { width: 72, padding: '3px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--dsw-alias-border-1, #d0d0d0)', background: 'transparent', color: 'inherit', textAlign: 'right' }
		var BUTTON = { padding: '4px 12px', fontSize: 12, borderRadius: 4, border: '1px solid var(--dsw-alias-border-1, #d0d0d0)', background: 'transparent', color: 'inherit', cursor: 'pointer' }

		/** The tab body: run parameters, live progress, and the host's log. */
		function FarmPanel() {
			var statePair = react.useState(null)
			var state = statePair[0]
			var setState = statePair[1]
			var errorPair = react.useState(null)
			var error = errorPair[0]
			var setError = errorPair[1]
			var formPair = react.useState(null)
			var form = formPair[0]
			var setForm = formPair[1]
			var savedPair = react.useState(false)
			var saved = savedPair[0]
			var setSaved = savedPair[1]

			var pull = react.useCallback(function () {
				fetch('/onmyoji-api/status')
					.then(function (res) { return res.json() })
					.then(function (body) {
						if (!body || !body.ok) return
						setState(body.result)
						setError(null)
						setForm(function (current) {
							if (current !== null) return current
							return {
								rounds: body.result.config.rounds,
								battlesPerRound: body.result.config.battlesPerRound,
								intervalSec: Math.round(body.result.config.intervalMs / 1000),
							}
						})
					})
					.catch(function (reason) { setError(String(reason)) })
			}, [])

			react.useEffect(function () {
				pull()
				var handle = setInterval(pull, 2000)
				return function () { clearInterval(handle) }
			}, [pull])

			var save = function () {
				fetch('/onmyoji-api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						rounds: Number(form.rounds),
						battlesPerRound: Number(form.battlesPerRound),
						intervalMs: Number(form.intervalSec) * 1000,
					}),
				}).then(function () { setSaved(true); pull() }).catch(function (reason) { setError(String(reason)) })
			}

			var rows = [react.createElement('div', { key: 'title', style: { fontWeight: 600, marginBottom: 10 } }, '阴阳师刷票')]
			if (error !== null) {
				rows.push(react.createElement('div', { key: 'err', style: { color: 'var(--dsw-alias-text-danger, #c0392b)', marginBottom: 8, fontSize: 12 } }, error))
			}
			if (form === null) {
				rows.push(react.createElement('div', { key: 'loading', style: { opacity: 0.6, fontSize: 12 } }, '正在连接宿主…'))
			} else {
				var field = function (key, label, hint) {
					return react.createElement('div', { key: key, style: FIELD }, [
						react.createElement('span', { key: 'l', style: LABEL }, label),
						react.createElement('input', {
							key: 'i', type: 'number', value: form[key], style: INPUT,
							onChange: function (event) {
								var value = event.target.value
								setSaved(false)
								setForm(function (current) {
									var next = {}
									for (var name in current) next[name] = current[name]
									next[key] = value
									return next
								})
							},
						}),
						hint === undefined ? null : react.createElement('span', { key: 'h', style: LABEL }, hint),
					])
				}
				rows.push(field('rounds', '刷取轮数', '轮'))
				rows.push(field('battlesPerRound', '每轮场次', '场'))
				rows.push(field('intervalSec', '轮间隔', '秒'))
				rows.push(react.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, margin: '10px 0' } }, [
					react.createElement('button', { key: 'save', style: BUTTON, onClick: save }, saved ? '已保存' : '保存'),
				]))
				if (state !== null) {
					rows.push(react.createElement('div', { key: 'stat', style: { fontSize: 12, opacity: 0.75, marginBottom: 8 } },
						'总计 ' + String((Number(form.rounds) || 0) * (Number(form.battlesPerRound) || 0)) + ' 场'
						+ ' · 已完成 ' + String(state.done) + '/' + String(state.total)
						+ ' · 点击 ' + String(state.clicks)
						+ ' · ' + (state.running ? '运行中' : '空闲')))
				}
				var log = state !== null && Array.isArray(state.log) ? state.log.slice(-20).reverse() : []
				rows.push(react.createElement('div', {
					key: 'log',
					style: { fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.8, whiteSpace: 'pre-wrap', lineHeight: 1.5 },
				}, log.map(function (entry) { return new Date(entry.at).toLocaleTimeString() + '  ' + entry.message }).join('\n')))
				if (state !== null) {
					rows.push(react.createElement('div', { key: 'store', style: { fontSize: 11, opacity: 0.6, marginTop: 10, wordBreak: 'break-all' } }, '参数文件：' + state.store))
				}
			}
			return react.createElement('div', { style: { padding: 12, fontSize: 13 } }, rows)
		}

		function apply(ctx) {
			ctx.effect(() => ctx.betterSidebar.registerTab({
				id: 'onmyoji:farm',
				title: () => '阴阳师刷票',
				icon: (size) => react.createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none' },
					react.createElement('circle', { cx: 8, cy: 8, r: 6.2, stroke: 'currentColor', strokeWidth: 1.4 }),
					react.createElement('path', { d: 'M8 4.6v3.9l2.6 1.6', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' })),
				order: 60,
				single: true,
				component: () => react.createElement(FarmPanel, null),
			}), 'onmyoji-sidebar: register farm tab')
		}

		var inject = ['betterSidebar']

		exports.apply = apply
		exports.inject = inject
		return module.exports
	},
})
