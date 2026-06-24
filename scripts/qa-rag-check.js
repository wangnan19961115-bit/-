const fs = require("fs");
const path = require("path");
const { loadKnowledgeBase, retrieveKnowledge, formatKnowledgeContext } = require("./rag-knowledge.js");

const rootDir = path.resolve(__dirname, "..");
const chunks = loadKnowledgeBase(rootDir);

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(chunks.length > 0, "RAG knowledge base should load markdown chunks");

const query = "AI代理运行手册 端口 8788 健康检查";
const matches = retrieveKnowledge(query, chunks, 3);
check(matches.length > 0, "RAG should retrieve relevant documentation for proxy queries");
check(matches.some((item) => item.text.includes("健康检查") || item.heading.includes("健康检查")), "RAG should hit relevant health-check context");

const formatted = formatKnowledgeContext(matches);
check(formatted.includes("Reference context") === false, "formatted knowledge context should only format matches");
check(!formatted.includes("OPENAI_API_KEY") || formatted.includes("docs/"), "RAG context should remain documentation-backed");

console.log("SymptomMate RAG Check");
console.log("=====================");
console.log(`Chunks: ${chunks.length}`);
console.log(`Matches: ${matches.length}`);

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All RAG checks passed.");
