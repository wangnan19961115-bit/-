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
```

当前验收记录见 `docs/qa/QA_TEST_MATRIX.md`，最终 QA 汇总见 `docs/reports/QA_FINAL_REPORT.md`。
