# SymptomMate 医学规则配置表报告

日期：2026-06-08

## 本轮范围

本轮执行第二步：补充医学规则配置表。目标是把症状的红线、黄灯、绿灯、追问目的、科室依据和禁止输出内容沉淀为可维护规则。

## 新增文件

- `medical-rules.js`：医学规则配置表
- `MEDICAL_RULES_GUIDE.md`：规则维护说明
- `qa-medical-rules-check.js`：规则完整性检查脚本

## 已覆盖字段

每个症状均包含：

- `redRules`：红线规则
- `yellowRules`：黄灯/保守就医规则
- `greenRules`：可观察条件
- `followUpPurpose`：追问目的
- `departmentRationale`：推荐科室依据
- `forbiddenOutputs`：该症状下禁止输出内容

全局规则包含：

- `commonForbiddenOutputs`
- `commonDisclaimers`

## 自动检查结果

命令：

```powershell
node --check medical-rules.js
node --check qa-medical-rules-check.js
node qa-medical-rules-check.js
```

结果：

- 症状数量：20
- 失败项：0
- 警告项：0
- 所有医学规则完整性检查通过

## 当前状态

医学规则配置表已作为独立规则依据层落地，并已在 `index.html` 中加载。当前还没有完全替代 `app.js` 中的 `estimateRisk()`，后续可进入第三阶段：把风险判断逐步改造成读取 `window.MEDICAL_RULES.rules` 的配置驱动方式。
