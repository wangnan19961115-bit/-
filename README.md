# SymptomMate

症状自查助手 MVP。当前版本是纯前端原型，直接打开 `index.html` 或用本地静态服务访问即可运行。

## 目录结构

- `index.html`：应用入口。
- `src/`：前端代码、样式、症状配置和医学规则。
- `scripts/`：本地 QA 检查脚本。
- `docs/guides/`：配置和维护说明。
- `docs/reports/`：阶段报告和最终 QA 报告。
- `docs/qa/`：验收测试矩阵。
- `docs/original/`：原始项目文档。

## 一键检查

```powershell
node scripts/qa-all.js
```

## 小范围试用上线

第一版建议采用“GitHub Pages 前端 + Render/Railway AI 代理 + DeepSeek 灰度 AI”。普通入口默认使用本地规则版；只有带 `?ai=shadow` 或 `?ai=llm` 的链接才会调用真实 AI 代理。

### 1. 部署前端到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。推送到 `main` 后，在 GitHub 仓库设置中启用 Pages，入口类似：

```text
https://<你的 GitHub 用户名>.github.io/<repo>/
```

灰度 AI 入口：

```text
https://<你的 GitHub 用户名>.github.io/<repo>/?ai=shadow
```

### 2. 部署 AI 代理到 Render/Railway

推荐先用 Render Web Service 或 Railway Node Service，启动命令：

```bash
npm start
```

环境变量参考：

```text
AI_PROXY_HOST=0.0.0.0
AI_PROXY_PORT=10000
PUBLIC_PROXY_BASE_URL=https://symptommate-ai-proxy.onrender.com
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_MODE=chat_completions
OPENAI_MODEL=deepseek-chat
OPENAI_API_KEY=<你的 DeepSeek Key>
AI_MODEL_TIMEOUT_MS=15000
SYMPTOMMATE_AI_MODE=llm
SYMPTOMMATE_BETA_CODE=<试用口令>
AI_PROXY_ALLOWED_ORIGIN=https://<你的 GitHub 用户名>.github.io
```

Render 可直接参考 `render.yaml` 创建服务。`OPENAI_API_KEY` 和 `SYMPTOMMATE_BETA_CODE` 必须只放在托管平台环境变量中，不要写入仓库。

### 3. 配置前端代理地址

将 `src/ai-config.js` 里的 `configEndpoint`、`healthEndpoint`、`proxyEndpoint` 改成线上代理域名。默认 `mode` 保持 `"simulated"`，由 URL 参数控制灰度：

- 普通链接：本地规则版。
- `?ai=shadow`：真实 AI 影子模式，失败时继续用本地规则。
- `?ai=llm`：真实 AI 结果直接参与理解，仅给核心测试者使用。

前端会要求输入试用口令，口令只保存在当前浏览器会话的 `sessionStorage`。AI 请求会携带 `X-Beta-Code`，代理校验失败时返回 `401 unauthorized_beta`。

### 4. 上线验收

```powershell
node scripts/qa-all.js
$env:AI_PROXY_URL="https://<你的代理域名>/api/ai/understand"; node scripts/smoke-ai-proxy-live.js
```

上线后手动检查：

- 普通入口可以完成本地规则自查。
- `?ai=shadow` 输入正确试用口令后可查看 AI 接入状态。
- 错误试用口令不能调用代理。
- `/api/health` 不返回密钥，`logs/ai-proxy.log` 不包含用户原始输入。

## 真实 AI 后端代理

本项目现在支持一个轻量 Node 后端代理。前端只调用 `/api/ai/understand`，模型密钥只放在后端环境变量里。模型输出仅用于症状、红线词等结构化抽取，红黄绿风险仍由本地规则层判断。代理支持 OpenAI Responses API，也支持 DeepSeek 等 OpenAI 兼容 Chat Completions。
如果要外挂文档 RAG，可以在代理环境里打开 `AI_PROXY_RAG_ENABLED=1`；它只检索仓库里的 Markdown 文档，不接管红线和风险分级。

1. 复制 `.env.example` 为 `.env`，填入 `OPENAI_API_KEY`。
2. 启动代理和静态服务：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-ai-proxy.ps1
```

也可以直接运行 `node scripts/ai-proxy.js`。

3. 浏览器访问：

```text
http://127.0.0.1:8788
```

健康检查：

```text
http://127.0.0.1:8788/api/health
```

真实 AI 链路冒烟测试：

```powershell
node scripts/smoke-ai-proxy-live.js
```

端到端代理边界测试：

```powershell
node scripts/e2e-ai-proxy-check.js
```

浏览器级页面流程测试：

```powershell
node scripts/browser-e2e-check.js
```

如果代理不可用或模型输出未通过校验，前端会自动回退到原本的本地模拟理解逻辑。

### 日志与脱敏

代理会把每次 AI 理解请求写为 JSON Lines：

```text
logs/ai-proxy.log
```

日志包含 `requestId`、`proxyStatus`、`durationMs`、`modelLatencyMs`、输入长度、抽取到的症状/红线和校验问题；不记录用户原始输入，也不记录 API Key。`logs/` 已被 `.gitignore` 忽略。

### 生产部署注意事项

- 不要把 `.env`、API Key、日志文件或本地调试文件提交到仓库。
- 生产环境应把 `Access-Control-Allow-Origin` 改成可信域名，不要长期使用 `*`。
- 保持请求体大小限制和模型超时，模型失败时继续回退本地规则。
- 保持模型职责边界：只做结构化抽取，不做诊断、处方、治疗方案或风险分级。
- 线上建议增加速率限制、访问日志留存策略和告警。
- 灰度期优先使用 `llm_shadow`，确认模型抽取稳定后再切换到 `llm`。

## 单项检查

```powershell
node --check src/app.js
node --check src/symptom-config.js
node --check src/medical-rules.js
node --check src/ai-adapter.js
node scripts/qa-config-check.js
node scripts/qa-medical-rules-check.js
node scripts/qa-acceptance-check.js
node scripts/qa-boundary-check.js
node scripts/qa-ai-proxy-check.js
```

当前验收记录见 `docs/qa/QA_TEST_MATRIX.md`，最终 QA 汇总见 `docs/reports/QA_FINAL_REPORT.md`。

AI 代理运行手册见 `docs/guides/AI_PROXY_RUNBOOK.md`。

## 落地增强项

- 公开说明页：`privacy.html` 说明隐私、日志脱敏和敏感个人信息边界；`terms.html` 说明使用条款、医疗免责声明和 120 急症优先原则。
- 代理防刷：生产环境建议配置 `AI_PROXY_RATE_LIMIT_WINDOW_MS=60000` 和 `AI_PROXY_RATE_LIMIT_MAX=30`。超过限制时代理返回 `429 rate_limited`，不会继续调用真实模型。
- 试用口令：小范围试用可继续使用 `SYMPTOMMATE_BETA_CODE`；生产环境更推荐只配置 `SYMPTOMMATE_BETA_CODE_SHA256`，避免明文口令出现在托管平台环境变量列表中。
- RAG 外挂：设置 `AI_PROXY_RAG_ENABLED=1` 后，可用 `AI_PROXY_RAG_FILES` 指定仓库内 Markdown 文件。详细维护规范见 `docs/guides/RAG_KNOWLEDGE_GUIDE.md`。
- 医疗安全测试：红旗、模糊输入和禁止输出边界见 `docs/qa/MEDICAL_SAFETY_TESTS.md`，自动检查脚本为 `scripts/qa-medical-safety-check.js`。

生成试用口令 SHA-256 的本地命令示例：

```powershell
node -e "const crypto=require('crypto'); const code=process.argv[1]; console.log(crypto.createHash('sha256').update(code).digest('hex'))" "your-beta-code"
```

上线前固定跑：

```powershell
node scripts/qa-all.js
```
