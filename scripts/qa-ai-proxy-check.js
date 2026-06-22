const fs = require("fs");

const proxy = fs.readFileSync("scripts/ai-proxy.js", "utf8");
const adapter = fs.readFileSync("src/ai-adapter.js", "utf8");
const app = fs.readFileSync("src/app.js", "utf8");
const config = fs.readFileSync("src/ai-config.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
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
