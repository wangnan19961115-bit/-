# SymptomMate 症状配置库维护说明

症状配置集中在 `symptom-config.js`。以后新增症状时，优先改这个文件，通常不需要改 `app.js`。

## 新增症状步骤

1. 在 `symptoms` 数组里追加症状名称。
2. 在 `symptomProfiles` 里新增同名配置：
   - `department`：主推荐科室
   - `backup`：备选科室
   - `checks`：可能需要的检查
   - `care`：下一步护理/观察建议
   - `questions`：面诊时可以问医生的问题
   - `related`：需要排查的方向，避免写成诊断结论
3. 在 `symptomQuestions` 里新增 5 个追问。
   - 每个问题必须有 `id`、`label`、`text`、`options`
   - 普通选项写字符串即可
   - 红线选项写成 `{ text: "选项文案", red: true }`
4. 在 `relatedWords` 里增加用户可能输入的近义词。
5. 在 `escalationSignalsBySymptom` 里增加“出现这些情况请升级处理”的提示。

## 示例

```js
鼻塞: {
  department: "耳鼻喉科",
  backup: "全科 / 呼吸内科",
  checks: ["鼻腔检查", "必要时过敏相关评估"],
  care: ["保持休息和补水", "记录持续时间和伴随症状"],
  questions: ["是否需要排查过敏？", "什么情况下需要复诊？"],
  related: ["上呼吸道感染相关表现", "过敏相关鼻部不适"],
}
```

```js
鼻塞: [
  {
    id: "nose_duration",
    label: "持续时间",
    text: "鼻塞持续多久了？",
    options: ["少于3天", "3-7天", "超过7天", "超过14天"],
  },
  {
    id: "nose_breath",
    label: "呼吸影响",
    text: "有没有明显呼吸困难？",
    options: ["没有", "轻微影响", { text: "明显呼吸困难", red: true }],
  },
]
```

## 文案边界

- 不写“你可能得了某病”，统一写“需要排查的方向”。
- 不输出药物剂量、处方、治疗方案。
- 对儿童、老人、孕产妇、基础病人群保持更保守的就医建议。
