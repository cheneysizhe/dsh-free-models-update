# DSH OpenRouter 免费模型插件

DeepSeek Harness Desktop 插件：在「设置」中一键管理 **OpenRouter 免费（`:free`）模型**。

- 设置 → 左侧导航出现「**免费模型**」页面
- 🔑 输入并保存你自己的 OpenRouter Key（走 DSH 官方凭据通道，只存本机 `~/.dsh/.credentials.yaml`）
- 🧪 测试调用：校验 Key 有效性 + 真实调用一个免费模型
- 🔄 一键更新：拉取 OpenRouter 实时 `:free` 模型清单并写入配置，模型选择器即时生效
- 📋 模型清单：名称 / id / **文本·多模态**徽章 / **NEW** 徽章（7 天内新增）· 按最新倒序置顶
- ⌨️ 附带命令 `/update-free-models` 可随时刷新

## 安装

1. 下载本仓库（Code → Download ZIP，或 `git clone`）
2. 双击 **`install.cmd`**（Windows），脚本会自动：
   - 定位你的 DSH 配置目录（`%USERPROFILE%\.dsh`，可用 `DSH_HOME` 环境变量覆盖）
   - 把插件复制到 `profiles\node_modules\dsh-free-models-update`
   - 向 `profiles\desktop\cordis.patch.yml` 追加插件条目（幂等，重复运行安全）
3. **完全退出并重启 DSH Desktop**
4. 打开 **设置 → 免费模型** → 粘贴你自己的 OpenRouter Key（[openrouter.ai/keys](https://openrouter.ai/keys) 免费注册）→ 保存 → 测试调用 → 一键更新

> 卸载：双击 `uninstall.cmd`，然后重启 DSH。

## 工作原理与安全

| 项 | 说明 |
|---|---|
| 模型列表 | 来自 OpenRouter **公开接口** `/api/v1/models`，不需要 Key |
| 调用模型 | 走 DSH 凭据系统，用**你本机**的 Key（`OPENROUTER_API_KEY`） |
| 密钥存储 | 只存于 `~/.dsh/.credentials.yaml`，**不进插件代码、不进设置文件、不联网上传** |
| 路由访问 | 仅接受本机回环 + 同源浏览器请求 |
| 兼容性 | DSH Desktop 2.x（Windows） |

**免费模型的速率限制**：OpenRouter 免费档有请求限制（高峰期可能 429），属正常现象，稍后重试或换一个免费模型即可；Key 本身没有问题。

## 目录结构

```
dsh-free-models-update/
├── index.js      # 宿主插件：命令 + /free-models-update 路由（state/refresh/test/key）
├── client.js     # 客户端 bundle：注册设置页「免费模型」
└── package.json  # 包声明（exports ./client + dsh.client）
install.cmd / install.ps1    # 安装（幂等）
uninstall.cmd / uninstall.ps1# 卸载
test-plugin-v2.mjs           # 离线验证脚本（node test-plugin-v2.mjs）
```

## 开发备注

- 插件是零依赖 ESM；宿主侧用 cordis 对象插件形态（`name`/`inject`/`apply`），客户端 bundle 遵循官方 `window.__ModuleLoader__.load({ id, factory })` 格式
- 刷新逻辑：`settings.mutate('llm-pi-ai', [...])` 写 `providers.openrouter.models`（路径 op 自动建对象、过 llm-pi-ai 校验器、热加载生效）
- 参考官方文档：`docs/user/develop/basic/index.zh.md`、`packages/client/AGENTS.md`、`docs/subsystems/slots.md`

## License

MIT © 陈思哲 (cheneysizhe)
