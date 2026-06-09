# SymptomMate MVP 交付说明

日期：2026-06-09

## 当前交付状态

MVP 已完成核心自查路径、红线预警、特殊人群保守判断、结果页、历史记录、反馈记录、本地数据看板和 QA 自动化检查。

当前一键 QA：

```powershell
node scripts/qa-all.js
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

## 后续开发建议

1. 接真实大模型时，只让模型做自然语言理解和结构化抽取。
2. 红线、黄灯和绿灯判断继续优先由 `medical-rules.js` 驱动。
3. 每次改动后先跑 `node scripts/qa-all.js`，再做页面抽检。
4. 正式上线前需要医学专业人员复核规则和合规文案。
