const fs = require("fs");

const files = {
  index: read("index.html"),
  app: read("src/app.js"),
  proxy: read("scripts/ai-proxy.js"),
  rag: read("scripts/rag-knowledge.js"),
  readme: read("README.md"),
  envExample: read(".env.example"),
  render: read("render.yaml"),
  privacy: read("privacy.html"),
  terms: read("terms.html"),
  ragGuide: read("docs/guides/RAG_KNOWLEDGE_GUIDE.md"),
  safetyTests: read("docs/qa/MEDICAL_SAFETY_TESTS.md"),
};

const failures = [];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(files.privacy.includes("不记录用户原始输入"), "privacy page should state raw user input is not logged");
check(files.privacy.includes("sessionStorage"), "privacy page should explain beta code sessionStorage storage");
check(files.privacy.includes("敏感个人信息"), "privacy page should mention sensitive personal information");
check(files.privacy.includes("120"), "privacy page should include emergency guidance");
check(files.terms.includes("不是医疗诊断"), "terms page should include medical diagnosis disclaimer");
check(files.terms.includes("不提供处方"), "terms page should reject prescriptions and treatment plans");
check(files.terms.includes("AI 灰度"), "terms page should explain AI gray mode");
check(files.app.includes("privacy.html") && files.app.includes("terms.html"), "app should link privacy and terms pages");
check(files.index.includes("v=20260719"), "index should bump static asset cache version after landing changes");

check(files.proxy.includes("SYMPTOMMATE_BETA_CODE_SHA256"), "proxy should support hashed beta code");
check(files.proxy.includes("timingSafeEqual"), "proxy should compare beta code safely");
check(files.proxy.includes("AI_PROXY_RATE_LIMIT_MAX"), "proxy should support rate-limit max config");
check(files.proxy.includes("rate_limited"), "proxy should return rate_limited when over quota");
check(files.proxy.includes("AI_PROXY_RAG_FILES"), "proxy should support injectable RAG file lists");
check(files.rag.includes("resolveMarkdownFile"), "RAG loader should restrict knowledge files to local markdown");
check(files.rag.includes("docs/guides/RAG_KNOWLEDGE_GUIDE.md"), "RAG guide should be part of the default knowledge base");

check(files.envExample.includes("SYMPTOMMATE_BETA_CODE_SHA256"), ".env.example should document hashed beta code");
check(files.envExample.includes("AI_PROXY_RATE_LIMIT_MAX"), ".env.example should document proxy rate limiting");
check(files.envExample.includes("AI_PROXY_RAG_FILES"), ".env.example should document RAG file list injection");
check(files.render.includes("AI_PROXY_RATE_LIMIT_MAX"), "render.yaml should include rate limit configuration");
check(files.render.includes("SYMPTOMMATE_BETA_CODE_SHA256"), "render.yaml should include hashed beta code secret");

check(files.ragGuide.includes("官方") && files.ragGuide.includes("Markdown"), "RAG guide should require curated markdown sources");
check(files.safetyTests.includes("红旗") && files.safetyTests.includes("120"), "medical safety test doc should cover red flags and emergency handling");
check(files.readme.includes("privacy.html") && files.readme.includes("AI_PROXY_RATE_LIMIT_MAX"), "README should document landing pages and rate limiting");

console.log("SymptomMate Production Readiness Check");
console.log("======================================");

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All production readiness checks passed.");
