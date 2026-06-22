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

## 真实 AI 后端代理

本项目现在支持一个轻量 Node 后端代理。前端只调用 `/api/ai/understand`，模型密钥只放在后端环境变量里。模型输出仅用于症状、红线词等结构化抽取，红黄绿风险仍由本地规则层判断。代理支持 OpenAI Responses API，也支持 DeepSeek 等 OpenAI 兼容 Chat Completions。

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
