# dsh-onmyoji-sidebar

DSH 侧边栏的**阴阳师刷票控制面板**：一个侧边栏标签页，用来设置刷取轮数、每轮场次、轮间隔，并实时显示进度与宿主日志。

**这个仓库不含自动点击逻辑。** 面板只是控制面与观测面：它保存运行参数、展示进度。真正的循环由一个带 computer-use 的 Agent 会话执行 —— 它读取这里的参数、逐场点击、再通过 `/onmyoji-api/report` 把轮次/场次/点击数写回来。单独安装本插件只会得到一个可设置参数的面板。

## 组成

零构建插件（源码即产物）：

| 半边 | 文件 | 作用 |
|---|---|---|
| host | `lib/index.js` | 在 `webServer` 上注册 `/onmyoji-api` 前缀路由，持有参数与进度状态 |
| browser | `client.js` | 通过 `ctx.betterSidebar.registerTab` 注册「阴阳师刷票」标签（`id: onmyoji:farm`，`order: 60`） |

路由（均返回 `{ ok, result | error }`）：

| 动作 | 方法 | 说明 |
|---|---|---|
| `/onmyoji-api/status` | GET | 返回当前参数与进度（面板每 2 秒轮询一次） |
| `/onmyoji-api/config` | POST | 写入运行参数，越界值按声明区间钳制 |
| `/onmyoji-api/report` | POST | 由执行循环回报 `round / done / clicks / total / running / message / error` |

参数区间：`rounds` 1–999，`battlesPerRound` 1–50，`intervalMs` 0–3600000；默认 `1 轮 × 5 场，间隔 30 秒`。
参数存于 `<DSH_HOME ?? ~/.dsh>/onmyoji-sidebar.json`，只落盘参数本身（进度与日志在内存，重启即清空）。
`/onmyoji-api` 拒绝 `Sec-Fetch-Site: cross-site` 的请求。

## 依赖与安装

浏览器半依赖第三方侧边栏插件 `dsh-better-sidebar`（提供 `ctx.betterSidebar`），以及宿主注入的 `react`。

```sh
cd ~/.dsh/profiles/<profile>
# package.json dependencies 加：
#   "dsh-onmyoji-sidebar": "link:<本仓库绝对路径>"
#   以及 dsh-better-sidebar 本身
pnpm install
```

在 `cordis.patch.yml` 的 `bundles` 里加上 `dsh-onmyoji-sidebar`，重启 DSH。

## 许可

MIT。见 [LICENSE](./LICENSE)。
