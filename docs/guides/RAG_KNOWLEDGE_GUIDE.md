# RAG 知识库维护指南

SymptomMate 当前使用轻量本地文档 RAG。它只读取仓库里的 Markdown 文件，把相关片段作为模型输入理解的参考上下文，不接管红黄绿风险判断，也不替代本地医疗规则。

## 适合放入 RAG 的内容

- 官方指南、医院科普、医学会共识、项目运行手册和经过人工整理的 Markdown 文档。
- 每份文档应写清楚来源、发布日期或更新时间、适用人群和不适用范围。
- 内容应帮助模型理解术语、问诊准备、代理运行和项目规则，不应要求模型给出诊断、处方或治疗方案。

## 不应放入 RAG 的内容

- API Key、试用口令、`.env`、日志、用户原始输入、个人联系方式、身份证号、电话、住址、医保号。
- 未确认来源的网页摘抄、广告软文、个人经验帖、过期指南。
- 药物剂量、处方模板、确诊结论或会绕过红旗规则的指令。

## 如何外挂新的 Markdown

1. 在仓库内新增经过人工审核的 Markdown，例如 `docs/knowledge/fever-guide.md`。
2. 在文件顶部写清楚来源和更新时间。
3. 在代理环境变量中配置文件清单：

```text
AI_PROXY_RAG_ENABLED=1
AI_PROXY_RAG_FILES=README.md,docs/guides/AI_PROXY_RUNBOOK.md,docs/knowledge/fever-guide.md
```

4. 本地运行：

```powershell
node scripts/qa-rag-check.js
node scripts/qa-all.js
```

## 安全边界

- RAG 文件必须是仓库内的 `.md` 文件，代理会忽略非 Markdown 和跳出仓库目录的路径。
- RAG 只给模型提供参考上下文，最终风险分级仍由 `src/medical-rules.js` 和前端规则层完成。
- 新增医学内容后，必须补充红旗、模糊输入和边界病例测试。

