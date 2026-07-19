const fs = require("fs");
const path = require("path");

const DEFAULT_KNOWLEDGE_FILES = [
  "README.md",
  "docs/guides/AI_ADAPTER_GUIDE.md",
  "docs/guides/AI_PROXY_RUNBOOK.md",
  "docs/guides/RAG_KNOWLEDGE_GUIDE.md",
  "docs/guides/MEDICAL_RULES_GUIDE.md",
  "docs/guides/SYMPTOM_CONFIG_GUIDE.md",
  "docs/reports/AI_INTEGRATION_PLAN.md",
  "docs/reports/AI_PROXY_FINAL_REPORT.md",
  "docs/reports/DELIVERY_NOTES.md",
  "docs/reports/QA_FINAL_REPORT.md",
  "docs/reports/QA_REPORT.md",
  "docs/reports/MEDICAL_RULES_REPORT.md",
  "docs/qa/QA_TEST_MATRIX.md",
  "docs/qa/MEDICAL_SAFETY_TESTS.md",
];

function loadKnowledgeBase(rootDir, fileList = DEFAULT_KNOWLEDGE_FILES) {
  const chunks = [];
  for (const relativePath of fileList) {
    const filePath = resolveMarkdownFile(rootDir, relativePath);
    if (!filePath) continue;
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    chunks.push(...chunkMarkdown(text, normalizeSourcePath(rootDir, filePath)));
  }
  return chunks;
}

function resolveKnowledgeFiles(value) {
  if (!value) return DEFAULT_KNOWLEDGE_FILES;
  return String(value)
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveMarkdownFile(rootDir, relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!/\.md$/i.test(normalized)) return null;
  const filePath = path.resolve(rootDir, normalized);
  const rootPath = path.resolve(rootDir);
  const relative = path.relative(rootPath, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return filePath;
}

function normalizeSourcePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function chunkMarkdown(text, source) {
  const lines = String(text || "").split(/\r?\n/);
  const chunks = [];
  let heading = source;
  let buffer = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (!content) return;
    chunks.push({
      source,
      heading,
      text: normalizeWhitespace(content),
    });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) {
      flush();
      heading = trimmed.replace(/^#{1,6}\s+/, "").trim();
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    buffer.push(trimmed);
  }

  flush();
  return chunks;
}

function retrieveKnowledge(query, chunks, limit = 4) {
  const terms = extractTerms(query);
  if (!terms.length) return [];
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk.text, terms, chunk.heading),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function scoreChunk(text, terms, heading = "") {
  const haystack = `${heading}\n${text}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;
    if (haystack.includes(normalized)) score += 3;
    const fuzzy = removeSeparators(haystack).includes(removeSeparators(normalized));
    if (fuzzy) score += 1;
  }
  if (/\bqa\b/i.test(heading) || /代理|配置|规则|风险|症状|日志/.test(heading)) score += 1;
  return score;
}

function extractTerms(query) {
  return normalizeKeywords(query)
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 12);
}

function normalizeKeywords(text) {
  return String(text || "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function removeSeparators(text) {
  return String(text || "").replace(/[\s\p{P}]+/gu, "");
}

function formatKnowledgeContext(items) {
  if (!items.length) return "";
  return items
    .map((item, index) => `[#${index + 1} ${item.source} :: ${item.heading}]\n${item.text}`)
    .join("\n\n");
}

module.exports = {
  DEFAULT_KNOWLEDGE_FILES,
  resolveKnowledgeFiles,
  loadKnowledgeBase,
  retrieveKnowledge,
  formatKnowledgeContext,
};
