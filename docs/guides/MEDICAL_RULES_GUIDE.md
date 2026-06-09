# SymptomMate 医学规则配置表说明

医学规则集中在 `medical-rules.js`。它是产品安全和内容边界的规则依据层，不是诊断引擎。

## 每个症状需要维护的字段

- `redRules`：必须立即线下处理或急诊评估的红线信号。
- `yellowRules`：建议尽快就医评估的保守条件。
- `greenRules`：可短期观察的最低条件。
- `followUpPurpose`：为什么要问这些问题，用于解释追问目的。
- `departmentRationale`：推荐科室的依据。
- `forbiddenOutputs`：该症状下额外禁止输出的内容。

## 全局规则

- `commonForbiddenOutputs`：所有症状都适用的禁止输出内容。
- `commonDisclaimers`：所有结果都需要遵守的免责声明边界。

## 使用原则

1. 红线规则优先级最高，命中后不继续自查。
2. 黄灯规则用于保守建议，不做诊断。
3. 绿灯只代表当前信息下未见必须立即急诊信号，不代表“没病”。
4. 儿童、老人、孕产妇和有基础病人群默认更保守。
5. 禁止输出药物剂量、治疗方案、确诊结论和“不用就医”的保证性话术。

## 后续接入建议

当前 `medical-rules.js` 已被 `index.html` 加载，后续可以逐步把 `app.js` 的 `estimateRisk()` 改为读取 `window.MEDICAL_RULES.rules`，实现配置驱动的红/黄/绿判断。
