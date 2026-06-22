# SymptomMate 真实 AI 后端代理最终报告

日期：2026-06-22

## 交付结论

真实 AI 后端代理已完成并通过验收。前端不暴露模型密钥，后端代理负责调用模型并返回结构化抽取结果；红线、黄灯、绿灯风险判断仍由本地 `medical-rules.js` 完成。

## 已实现能力

- 轻量 Node 后端代理：`scripts/ai-proxy.js`
- 静态页面服务：访问 `http://127.0.0.1:8788/`
- AI 理解接口：`POST /api/ai/understand`
- 健康检查：`GET /api/health`
- 非敏感配置：`GET /api/config`
- OpenAI Responses API 与 OpenAI 兼容 Chat Completions 双模式
- DeepSeek `deepseek-chat` 本地配置示例
- 前端模式开关：`simulated` / `llm_shadow` / `llm`
- 前端 AI 状态提示与“我的”页 AI 调试面板
- 后端结构化输出归一化和安全校验
- 模型超时、payload 大小限制、失败回退
- JSON Lines 日志：`logs/ai-proxy.log`
- 密钥安全检查：`scripts/qa-secret-check.js`
- 一键启动脚本：`scripts/start-ai-proxy.ps1`
- 运行手册：`docs/guides/AI_PROXY_RUNBOOK.md`

## 安全边界

- 模型只做自然语言理解和结构化抽取。
- 模型不得输出诊断、处方、治疗方案或最终风险分级。
- 风险分级继续由本地医学规则层决定。
- API Key 仅放在 `.env`，不进入前端。
- 日志不记录原始用户输入，不记录 API Key。
- `.env`、`logs/` 和 `*.log` 已被 `.gitignore` 忽略。

## 验收结果

已执行并通过：

```powershell
node scripts\qa-all.js
node scripts\qa-secret-check.js
node scripts\smoke-ai-proxy-live.js
node scripts\e2e-ai-proxy-check.js
node scripts\browser-e2e-check.js
```

真实链路抽检输入：

```text
胸痛半小时，伴随呼吸困难
```

模型抽取结果：

```json
{
  "symptom": "胸痛",
  "redFlag": "呼吸困难",
  "extracted": {
    "duration": "半小时",
    "group": "成年人",
    "associatedSymptoms": ["呼吸困难"]
  },
  "confidence": 0.95
}
```

## 已知限制

- 本地代理默认绑定 `127.0.0.1:8788`，端口变化时需要同步前端 `src/ai-config.js`。
- 当前 CORS 为开发便利使用 `*`，生产环境应限制为可信域名。
- 当前没有速率限制和用户认证，生产前需要补齐。
- live smoke/E2E 依赖外网和模型服务可用性。
- 规则和合规文案仍需医学/合规专业人员复核。

## 后续建议

1. 上线前先使用 `llm_shadow` 灰度观察模型抽取质量。
2. 增加服务端速率限制和可信 origin 配置。
3. 增加日志轮转和告警。
4. 将前端配置从静态 `src/ai-config.js` 进一步迁移为运行时配置。
5. 继续完善真实浏览器自动化测试。
