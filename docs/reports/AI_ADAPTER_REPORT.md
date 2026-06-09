# SymptomMate AI 接口层报告

日期：2026-06-08

## 本轮范围

本轮执行第四步：准备接 AI 的接口层。目标是在不接真实大模型、不引入后端的情况下，把现有规则流程封装成可替换的模拟 AI 层。

## 新增文件

- `ai-adapter.js`：模拟 AI 接口层
- `AI_ADAPTER_GUIDE.md`：AI 接口层说明
- `AI_ADAPTER_REPORT.md`：本报告

## 接入内容

`app.js` 现在通过 `window.AI_ADAPTER` 处理：

- 自由输入理解
- 症状识别
- 红线关键词识别
- 追问目的解释
- 红/黄/绿风险估计
- 结果原因文案

## 当前模式

```text
AI_ADAPTER.mode = simulated
```

当前仍然使用：

- `symptom-config.js`
- `medical-rules.js`

因此不会产生不可控诊断或处方输出。

## 验证命令

```powershell
node --check ai-adapter.js
node --check app.js
node --check symptom-config.js
node --check medical-rules.js
```

结果：全部通过。

## 后续建议

下一阶段如果接真实大模型，优先替换 `ai-adapter.js` 的 `understandInput()`，让模型只做自然语言理解和结构化抽取，再由规则层决定红线和风险等级。
