# SymptomMate MVP 交付说明

日期：2026-06-22

## 当前交付状态

MVP 已完成核心自查路径、红线预警、特殊人群保守判断、结果页、历史记录、反馈记录、本地数据看板、QA 自动化检查，以及真实 AI 后端代理接入。

当前一键 QA：

```powershell
node scripts/qa-all.js
```

真实 AI 代理验收：

```powershell
node scripts/smoke-ai-proxy-live.js
node scripts/e2e-ai-proxy-check.js
node scripts/browser-e2e-check.js
node scripts/qa-secret-check.js
```

通过标准：

- 配置检查 failures 0 / warnings 0
- 医学规则检查 failures 0 / warnings 0
- 红线、特殊人群、普通低风险、黄灯、结果页完整性均 failures 0
- 边界用例 B-01 到 B-06 failures 0

## 关键入口

- 应用入口：`index.html`
- 核心逻辑：`src/app.js`
- 模拟 AI 接口层：`src/ai-adapter.js`
- 症状配置：`src/symptom-config.js`
- 医学规则：`src/medical-rules.js`
- 验收矩阵：`docs/qa/QA_TEST_MATRIX.md`
- 最终 QA 报告：`docs/reports/QA_FINAL_REPORT.md`
- AI 代理：`scripts/ai-proxy.js`
- AI 前端配置：`src/ai-config.js`
- AI 代理运行手册：`docs/guides/AI_PROXY_RUNBOOK.md`
- AI 代理最终报告：`docs/reports/AI_PROXY_FINAL_REPORT.md`

## 本次 AI 代理新增文件

- `.env.example`
- `src/ai-config.js`
- `scripts/ai-proxy.js`
- `scripts/start-ai-proxy.ps1`
- `scripts/qa-ai-proxy-check.js`
- `scripts/qa-secret-check.js`
- `scripts/smoke-ai-proxy-live.js`
- `scripts/e2e-ai-proxy-check.js`
- `scripts/browser-e2e-check.js`
- `docs/guides/AI_PROXY_RUNBOOK.md`
- `docs/reports/AI_PROXY_FINAL_REPORT.md`

## 后续开发建议

1. 灰度期优先使用 `llm_shadow`，确认模型抽取稳定后再切换到 `llm`。
2. 红线、黄灯和绿灯判断继续优先由 `medical-rules.js` 驱动。
3. 每次改动后先跑 `node scripts/qa-all.js` 和 `node scripts/qa-secret-check.js`。
4. 正式上线前需要医学专业人员复核规则和合规文案。
5. 生产部署前补齐可信 CORS、速率限制、日志轮转和告警。
