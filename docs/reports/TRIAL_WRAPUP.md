# SymptomMate 试用收口报告

日期：2026-06-24

## 交付结论

本轮小范围试用已完成收口，项目已具备可对外试用的稳定版本：前端通过 GitHub Pages 发布，AI 代理通过 Render 托管，灰度 AI 通过 `?ai=shadow` 开启，试用口令由代理端校验，红线与风险分级仍由本地规则层负责。

## 已完成内容

- 前端默认保持本地规则版，支持 `simulated`、`llm_shadow`、`llm` 三种模式。
- AI 代理支持 DeepSeek 兼容 Chat Completions 接入。
- 代理端支持 `X-Beta-Code` 门禁，错误口令访问 `/api/config` 与 `/api/ai/understand` 均返回 `401 unauthorized_beta`。
- 增加了轻量文档 RAG：仅检索仓库内 Markdown 文档，不接外网网页或数据库。
- 增加了 mock E2E，确认不需要真实 API Key 也能稳定跑自动化检查。
- 所有本地 QA 已通过。

## 已验证结果

- `node scripts/qa-all.js` 通过。
- `node scripts/qa-rag-check.js` 通过。
- `node scripts/e2e-ai-proxy-check.js` 通过。
- `node scripts/browser-e2e-check.js` 通过。
- 线上代理健康检查可用。
- GitHub Pages 入口可访问。

## 已知限制

- 当前仍是试用版，不包含账号体系、数据库、用户分组管理。
- RAG 只做轻量文档检索，不是向量数据库方案。
- 试用口令仍需人工分发，不适合公开传播。
- 医学结论仍以本地规则为准，模型只做结构化抽取和参考补充。

## 后续建议

- 若继续试用，保留 `?ai=shadow` 灰度链路。
- 若准备正式公开，补访问控制、速率限制和更完整的审计日志。
- 若继续增强 RAG，再考虑 embedding 和向量检索。
- 每次规则或代理改动后继续执行全量 QA。
