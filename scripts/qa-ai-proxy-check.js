const fs = require("fs");

const proxy = fs.readFileSync("scripts/ai-proxy.js", "utf8");
const adapter = fs.readFileSync("src/ai-adapter.js", "utf8");
const app = fs.readFileSync("src/app.js", "utf8");
const config = fs.readFileSync("src/ai-config.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");
const e2e = fs.readFileSync("scripts/e2e-ai-proxy-check.js", "utf8");
const renderConfig = fs.existsSync("render.yaml") ? fs.readFileSync("render.yaml", "utf8") : "";
const logFunction = proxy.slice(proxy.indexOf("function logProxyEvent"), proxy.indexOf("function validateProxyPayload"));

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(proxy.includes("/responses"), "proxy should support the OpenAI Responses API");
check(proxy.includes("/chat/completions"), "proxy should support OpenAI-compatible chat completions");
check(proxy.includes("process.env.OPENAI_API_KEY"), "proxy should read the API key from environment only");
check(proxy.includes("json_schema"), "proxy should request structured JSON output");
check(proxy.includes("normalizeExtraction"), "proxy should normalize model output server-side");
check(proxy.includes("validateExtraction"), "proxy should validate model output server-side");
check(proxy.includes("FORBIDDEN_OUTPUT_KEYS"), "proxy should block forbidden clinical output keys");
check(proxy.includes("fetchWithTimeout"), "proxy should set an upstream model timeout");
check(proxy.includes("createRequestId"), "proxy should attach request ids to AI calls");
check(proxy.includes("modelLatencyMs"), "proxy should log model latency");
check(proxy.includes("proxyStatus"), "proxy should return and log proxy status");
check(proxy.includes("logs") && proxy.includes("ai-proxy.log"), "proxy should write JSON logs to an ignored logs directory");
check(logFunction.includes("inputLength") && !logFunction.includes("userInput:"), "proxy logs should avoid raw user input");
check(proxy.includes("process.env.AI_PROXY_PORT || 8788"), "proxy server should default to port 8788");
check(proxy.includes('API_MODE === "mock"') && proxy.includes("callMockModel"), "proxy should support deterministic mock model mode");
check(proxy.includes("PUBLIC_PROXY_BASE_URL"), "proxy should support an explicit public proxy base url");
check(proxy.includes("SYMPTOMMATE_BETA_CODE") && proxy.includes("unauthorized_beta"), "proxy should protect AI calls with a beta code");
check(proxy.includes("SYMPTOMMATE_BETA_CODE_SHA256") && proxy.includes("timingSafeEqual"), "proxy should support hashed beta codes with safe comparison");
check(proxy.includes("AI_PROXY_RATE_LIMIT_MAX") && proxy.includes("rate_limited"), "proxy should rate limit AI calls");
check(proxy.includes("AI_PROXY_ALLOWED_ORIGIN") && proxy.includes("X-Beta-Code"), "proxy should support production CORS and beta code header");
check(proxy.includes("AI_PROXY_RAG_ENABLED") && proxy.includes("buildRagContext"), "proxy should support a local documentation RAG path");
check(proxy.includes("AI_PROXY_RAG_FILES") && proxy.includes("resolveKnowledgeFiles"), "proxy should support injectable local RAG markdown files");
check(proxy.includes("knowledgeBaseVersion") && proxy.includes("knowledgeBaseSize"), "proxy should expose RAG metadata in config");
check(adapter.includes("http://127.0.0.1:8788/api/ai/understand"), "adapter fallback should use the default proxy endpoint");
check(adapter.includes("X-Beta-Code") && adapter.includes("sessionStorage"), "adapter should send the beta code header from session storage");
check(config.includes('mode: "simulated"'), "browser config should default to simulated mode for public trials");
check(config.includes("grayModeQueryParam") && adapter.includes("URLSearchParams"), "browser config should support URL-driven AI gray mode");
check(config.includes("https://symptommate-ai-proxy.onrender.com"), "browser config should point production endpoints at the hosted proxy placeholder");
check(envExample.includes("AI_PROXY_PORT=8788"), ".env.example should document the default proxy port");
check(envExample.includes("SYMPTOMMATE_BETA_CODE") && envExample.includes("AI_PROXY_ALLOWED_ORIGIN"), ".env.example should document trial access and CORS variables");
check(envExample.includes("SYMPTOMMATE_BETA_CODE_SHA256") && envExample.includes("AI_PROXY_RATE_LIMIT_MAX"), ".env.example should document hashed beta code and rate limiting");
check(readme.includes("http://127.0.0.1:8788"), "README should document the default proxy browser endpoint");
check(e2e.includes('OPENAI_API_MODE: "mock"'), "AI proxy E2E should run against mock mode");
check(e2e.includes("wrong beta code is rejected"), "AI proxy E2E should verify bad beta code rejection");
check(e2e.includes("SYMPTOMMATE_BETA_CODE_SHA256"), "AI proxy E2E should verify hashed beta code mode");
check(e2e.includes("rate_limited"), "AI proxy E2E should verify deterministic rate limiting");
check(renderConfig.includes("symptommate-ai-proxy") && renderConfig.includes("OPENAI_API_KEY"), "Render config should define the proxy service and required secrets");
check(app.includes("aiStatusMeta"), "app should render visible AI status");
check(app.includes("AI 暂不可用，已回退本地规则"), "app should show fallback feedback");
check(adapter.includes("llm_shadow"), "adapter should support llm_shadow mode");
check(app.includes("ai_shadow_understanding"), "app should record shadow AI comparison events");
check(!config.includes("OPENAI_API_KEY") && !config.includes("sk-"), "browser config must not contain secrets");
check(adapter.includes("understandInputAsync"), "adapter should expose async understanding");
check(adapter.includes("normalizeModelExtraction"), "adapter should normalize model output");
check(adapter.includes("validateUnderstanding"), "adapter should validate model output before use");
check(app.includes("await understandFreeText"), "app should await the async adapter for free text");
check(index.indexOf("src/ai-config.js") < index.indexOf("src/ai-adapter.js"), "AI config should load before adapter");

console.log("SymptomMate AI Proxy Check");
console.log("==========================");

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All AI proxy checks passed.");
