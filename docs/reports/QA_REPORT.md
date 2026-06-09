# SymptomMate MVP QA 报告

日期：2026-06-08

## 本轮范围

本轮执行第一步：产品验收和用例测试准备。目标是把症状核心路径整理成可执行测试矩阵，并用脚本检查症状配置库是否完整。

## 自动检查结果

命令：

```powershell
node --check app.js
node --check symptom-config.js
node --check qa-config-check.js
node qa-config-check.js
node --check medical-rules.js
node --check qa-medical-rules-check.js
node qa-medical-rules-check.js
```

结果：

- `app.js` 语法通过
- `symptom-config.js` 语法通过
- `qa-config-check.js` 语法通过
- `medical-rules.js` 语法通过
- `qa-medical-rules-check.js` 语法通过
- 症状数量：20
- 配置失败项：0
- 配置警告项：0
- 医学规则失败项：0
- 医学规则警告项：0

## 已确认的配置完整性

- 20 个症状均存在：胸痛、头痛、腹痛、咳嗽、发热、腹泻、头晕、背痛、皮疹、呕吐、鼻塞、咽痛、耳痛、尿痛、月经异常、眼红、乏力、心慌、失眠、关节痛。
- 每个症状都有 `symptomProfiles`。
- 每个症状都有 5 个专属追问。
- 每个症状至少有 1 个红线选项。
- 每个症状都有近义词配置。
- 每个症状都有至少 3 条升级处理信号。
- 全局红线关键词库数量满足最低要求。

## 需要手工点测的内容

详见 `QA_TEST_MATRIX.md`。

优先级建议：

1. 先测 20 个症状的红线路径，确认不会误留“继续自查”入口。
2. 再测特殊人群路径，重点看儿童、老人、孕产妇、有基础病是否更保守。
3. 再测普通绿灯/黄灯路径，确认结果页解释是否能看懂。
4. 最后测历史记录、准备清单、问题清单、转诊单和反馈按钮。

## 当前结论

从配置完整性和代码语法角度看，当前 MVP 已具备进入系统化手工验收的条件。下一步应按 `QA_TEST_MATRIX.md` 逐条点测，并记录失败用例。
