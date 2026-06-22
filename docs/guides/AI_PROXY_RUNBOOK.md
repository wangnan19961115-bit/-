# SymptomMate AI 代理运行手册

## 本地启动

1. 复制 `.env.example` 为 `.env`。
2. 填入 `OPENAI_API_KEY`。
3. 启动代理：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-ai-proxy.ps1
```

或直接运行：

```powershell
node scripts\ai-proxy.js
```

默认访问地址：

```text
http://127.0.0.1:8788/
```

健康检查：

```text
http://127.0.0.1:8788/api/health
```

## 模式切换

在 `src/ai-config.js` 里切换：

```js
mode: "simulated"   // 纯本地规则
mode: "llm_shadow"  // 真实 AI 只观察，不影响用户路径
mode: "llm"         // 真实 AI 参与输入理解
```

上线前建议先用 `llm_shadow` 收集对比事件，再切 `llm`。

## 常见问题

### 网页打不开

先确认代理是否启动：

```powershell
curl.exe http://127.0.0.1:8788/api/health
```

如果连接失败，重新运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-ai-proxy.ps1
```

### 端口占用

如果 8788 被占用，修改 `.env`：

```env
AI_PROXY_PORT=8790
```

同时修改 `src/ai-config.js` 中的 `configEndpoint`、`healthEndpoint` 和 `proxyEndpoint`。

### Key 缺失或无效

健康检查里的 `hasApiKey` 应为 `true`。如果为 `false`，检查 `.env` 是否存在且包含：

```env
OPENAI_API_KEY=...
```

### 模型失败

前端会提示 AI 暂不可用，并回退本地规则。可用 `requestId` 到 `logs/ai-proxy.log` 排查。

### 日志在哪里

```text
logs/ai-proxy.log
```

日志不记录原始用户输入，不记录 API Key。`logs/` 已被 `.gitignore` 忽略。

## 验收命令

基础 QA：

```powershell
node scripts\qa-all.js
```

代理启动后，运行真实链路检查：

```powershell
node scripts\smoke-ai-proxy-live.js
node scripts\e2e-ai-proxy-check.js
node scripts\browser-e2e-check.js
```

密钥安全检查：

```powershell
node scripts\qa-secret-check.js
```

## 生产部署边界

- 不提交 `.env`、日志、密钥或本地调试文件。
- 生产 CORS 应限制为可信域名。
- 保留请求体大小限制和模型超时。
- 模型只做结构化抽取，不做诊断、处方、治疗方案或风险分级。
- 模型失败不能阻断主流程，必须回退本地规则。
- 建议增加速率限制、日志留存策略和告警。
