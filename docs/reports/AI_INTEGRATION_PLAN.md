# SymptomMate 真实 AI 接入计划

日期：2026-06-09

## 目标

为后续接入真实大模型预留稳定接口，让模型只负责自然语言理解和结构化抽取，继续由本地医学规则层负责红线、黄灯、绿灯判断。

当前版本已经在 `src/ai-adapter.js` 中新增 `AI_ADAPTER.integration`，但仍保持：

- `AI_ADAPTER.mode = "simulated"`
- 主流程不发起网络请求
- `understandInput()` 仍为同步本地模拟逻辑
- 现有 QA 验收不改变

## 非目标

本阶段不做以下内容：

- 不直接接入外部 API
- 不把风险等级交给模型判断
- 不让模型输出诊断、处方、治疗方案
- 不改变 `app.js` 当前同步调用链路

## 推荐架构

```text
用户自由输入
→ AI_ADAPTER.integration.createLlmInputPayload()
→ 后端代理调用真实模型
→ AI_ADAPTER.integration.normalizeModelExtraction()
→ AI_ADAPTER.integration.validateUnderstanding()
→ 本地 symptom-config / medical-rules 规则层
→ 红 / 黄 / 绿结果页
```

## 模型职责

模型只允许做“理解和整理”：

- 抽取症状实体
- 抽取持续时间、严重程度、人群信息
- 抽取伴随症状
- 从原文中识别可能的红线关键词
- 给出理解置信度

模型不能做：

- 疾病诊断
- 用药建议
- 治疗方案
- 是否急诊、是否转诊的最终判断

## 规则层职责

以下判断必须继续由本地规则完成：

- 红线信号确认
- 特殊人群保守升级
- 黄灯路径判断
- 绿灯路径判断
- 结果页原因说明
- 准备清单、问题清单、转诊单展示

## 当前接口

`src/ai-adapter.js` 新增：

```js
window.AI_ADAPTER.integration = {
  schemaVersion: "symptommate.llm-extraction.v1",
  createLlmInputPayload,
  normalizeModelExtraction,
  validateUnderstanding
};
```

### createLlmInputPayload(text, context)

生成未来发给后端或模型的标准载荷，包含：

- 用户输入
- 当前自查对象
- 当前症状上下文
- 允许的症状列表
- 允许的人群列表
- 红线关键词列表
- 输出契约
- 安全规则

### normalizeModelExtraction(extraction, context)

把模型输出收敛为前端可用格式：

```js
{
  symptom: "胸痛",
  redFlag: "呼吸困难",
  normalizedText: "",
  extracted: {
    duration: "半小时",
    severity: "",
    group: "",
    associatedSymptoms: ["呼吸困难"]
  },
  confidence: 0.92,
  source: "llm",
  schemaVersion: "symptommate.llm-extraction.v1"
}
```

### validateUnderstanding(result, context)

上线前必须拦截：

- 没有抽取到症状或红线词
- 症状不在本地配置列表
- 红线词不在本地关键词列表
- 置信度不在 `0-1`
- 输出包含诊断、处方、治疗方案字段

## 示例

输入：

```text
胸痛半小时，伴随呼吸困难
```

模型允许输出：

```js
{
  symptom: "胸痛",
  redFlag: "呼吸困难",
  extracted: {
    duration: "半小时",
    associatedSymptoms: ["呼吸困难"]
  },
  confidence: 0.92
}
```

最终是否红灯仍由 `medical-rules.js` 的 `redRules` 判断，不由模型决定。

## 分阶段推进

### 阶段 1：接口准备

状态：已完成。

- 保留模拟 AI
- 新增标准 payload
- 新增模型输出归一化
- 新增输出安全校验
- 完整 QA 通过后进入下一阶段

### 阶段 2：后端代理

建议新增轻量后端代理，前端不直接暴露模型密钥。

代理职责：

- 接收 `createLlmInputPayload()` 生成的载荷
- 调用模型
- 返回结构化 JSON
- 设置超时、重试、日志脱敏

### 阶段 3：灰度开关

建议保留模式开关：

```js
AI_ADAPTER.mode = "simulated" | "llm_shadow" | "llm"
```

- `simulated`：当前本地逻辑
- `llm_shadow`：真实模型只记录结果，不影响用户路径
- `llm`：真实模型参与输入理解，但风险判断仍走规则层

### 阶段 4：上线验收

真实 AI 接入前后都必须执行：

```powershell
node scripts/qa-all.js
```

并追加人工验收：

- 红线路径不允许出现“继续自查”
- 特殊人群至少黄灯
- 普通绿灯路径可进入结果页
- 普通黄灯路径可进入结果页
- 结果页准备清单、问题清单、转诊单可进出
- 历史记录保存正常
- 自由输入无法识别时给出保守提示

## 风险与控制

- 风险：模型幻觉症状或诊断。
  控制：只接受本地配置列表内的症状，拒绝诊断、处方、治疗方案字段。

- 风险：模型漏掉红线。
  控制：红线仍由本地关键词和 `medical-rules.js` 二次确认，低置信度默认保守。

- 风险：网络失败影响主流程。
  控制：保留 `simulated` 回退模式；模型调用失败时返回无法识别或走本地规则。

- 风险：隐私泄露。
  控制：后端代理日志脱敏，不记录完整自由输入，不在前端保存敏感原文。

## 下一步建议

下一项可以做“阶段 2 后端代理设计”，先不接真实模型密钥，只补一个本地 mock API 和前端模式开关，验证异步链路不会破坏现有 QA。
