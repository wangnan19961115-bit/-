# SymptomMate 症状扩展报告

日期：2026-06-08

## 本轮范围

本轮执行第五步：将 MVP 支持症状从 10 个扩展到 20 个。

## 新增症状

新增 10 个症状：

- 鼻塞
- 咽痛
- 耳痛
- 尿痛
- 月经异常
- 眼红
- 乏力
- 心慌
- 失眠
- 关节痛

## 已补充内容

在 `symptom-config.js` 中，新增症状均已补充：

- 首页症状入口
- 科室推荐和备选科室
- 检查建议
- 居家观察/就医准备建议
- 医生问题清单
- 需要排查的方向
- 5 轮专属追问
- 红线选项
- 近义词识别
- 升级处理信号

在 `medical-rules.js` 中，新增症状均已补充：

- 红线规则
- 黄灯规则
- 绿灯观察条件
- 追问目的
- 科室依据
- 禁止输出内容

## 同步更新

- `qa-config-check.js`：症状数量要求从 10 更新为 20。
- `QA_TEST_MATRIX.md`：新增 10 个症状的测试路径。
- `QA_REPORT.md`：同步更新为 20 个症状。
- `MEDICAL_RULES_REPORT.md`：同步更新为 20 个症状。

## 验证结果

已运行：

```powershell
node --check symptom-config.js
node --check medical-rules.js
node --check app.js
node --check ai-adapter.js
node qa-config-check.js
node qa-medical-rules-check.js
```

结果：

- 症状数量：20
- 配置失败项：0
- 配置警告项：0
- 医学规则失败项：0
- 医学规则警告项：0

## 当前结论

20 个症状扩展已完成，配置完整性和医学规则完整性检查均通过。下一步建议按 `QA_TEST_MATRIX.md` 对新增 10 个症状做手工红线优先测试。
