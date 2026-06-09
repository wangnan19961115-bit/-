# SymptomMate AI 接口层说明

AI 接口层集中在 `ai-adapter.js`。当前是模拟 AI，底层仍使用本地症状配置和医学规则；后续接真实大模型时，优先替换这个文件，而不是改 `app.js` 主流程。

## 当前接口

`window.AI_ADAPTER` 暴露：

- `mode`：当前模式，现为 `simulated`
- `understandInput(text, context)`：理解用户自由输入，返回症状、红线词、置信度
- `getQuestionPurpose(question)`：返回追问目的解释
- `estimateRisk(context)`：返回 `red` / `yellow` / `green`
- `getResultReason(risk, context)`：返回结果页解释文案

## 当前链路

```text
用户输入
→ AI_ADAPTER.understandInput
→ 症状识别 / 红线识别
→ 配置化专属追问
→ AI_ADAPTER.estimateRisk
→ 结果页
```

## 后续接真实 AI 的替换方式

可以把 `understandInput()` 替换为真实模型调用：

```text
用户输入
→ 安全关键词拦截
→ LLM 做症状实体识别、持续时间抽取、人群抽取
→ 规则层校验红线
→ 返回结构化 JSON
```

建议真实模型只负责“理解和整理输入”，不要让模型直接决定诊断或处方。

## 建议返回结构

```js
{
  symptom: "发热",
  redFlag: "",
  extracted: {
    duration: "1-3天",
    temperature: "38-39℃",
    group: "儿童"
  },
  confidence: 0.72,
  source: "llm"
}
```

## 安全边界

- 红线判断必须经过规则层确认。
- 风险等级必须可解释。
- 低置信度默认偏保守。
- 不允许模型输出诊断、处方、治疗方案。
