const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const LOG_PATH = path.join(LOG_DIR, "ai-proxy.log");
const RAG = require("./rag-knowledge.js");
loadDotEnv();

const PORT = Number(process.env.AI_PROXY_PORT || 8788);
const HOST = process.env.AI_PROXY_HOST || "127.0.0.1";
const API_MODE = process.env.OPENAI_API_MODE || "responses";
const IS_MOCK_MODEL = API_MODE === "mock" || process.env.AI_PROXY_MOCK === "1";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const PUBLIC_PROXY_BASE_URL = (process.env.PUBLIC_PROXY_BASE_URL || "").replace(/\/$/, "");
const MODEL = process.env.OPENAI_MODEL || (API_MODE === "chat_completions" ? "deepseek-chat" : "gpt-5.4-mini");
const MODEL_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS || 15000);
const BETA_CODE = process.env.SYMPTOMMATE_BETA_CODE || process.env.AI_PROXY_BETA_CODE || "";
const ALLOWED_ORIGIN = process.env.AI_PROXY_ALLOWED_ORIGIN || "";
const RAG_ENABLED = String(process.env.AI_PROXY_RAG_ENABLED || "").toLowerCase() === "1";
const KNOWLEDGE_BASE = RAG_ENABLED ? RAG.loadKnowledgeBase(ROOT_DIR) : [];
const KNOWLEDGE_BASE_VERSION = RAG_ENABLED ? hashKnowledgeBase(KNOWLEDGE_BASE) : "";
const FORBIDDEN_OUTPUT_KEYS = ["diagnosis", "prescription", "medicine", "treatmentPlan"];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["symptom", "redFlag", "normalizedText", "extracted", "confidence"],
  properties: {
    symptom: { type: "string" },
    redFlag: { type: "string" },
    normalizedText: { type: "string" },
    extracted: {
      type: "object",
      additionalProperties: false,
      required: ["duration", "severity", "group", "associatedSymptoms"],
      properties: {
        duration: { type: "string" },
        severity: { type: "string" },
        group: { type: "string" },
        associatedSymptoms: {
          type: "array",
          maxItems: 8,
          items: { type: "string" },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        model: MODEL,
        apiMode: API_MODE,
        baseUrl: BASE_URL,
        modelTimeoutMs: MODEL_TIMEOUT_MS,
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        requiresBetaCode: Boolean(BETA_CODE),
        ragEnabled: RAG_ENABLED,
        knowledgeBaseSize: KNOWLEDGE_BASE.length,
        knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      if (!authorizedBetaRequest(req)) {
        sendJson(res, 401, { error: "unauthorized_beta" });
        return;
      }
      sendJson(res, 200, publicConfig());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/understand") {
      await handleUnderstand(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("[ai-proxy] unexpected error", error);
    sendJson(res, 500, { error: "internal_error" });
  }
});

server.listen(PORT, HOST, () => {
  const listenPort = listeningPort();
  console.log(`SymptomMate AI proxy listening at http://${HOST}:${listenPort}`);
  console.log(`Model: ${MODEL}`);
  console.log(`API mode: ${API_MODE}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(BETA_CODE ? "Beta code: required" : "Beta code: not required");
  console.log(IS_MOCK_MODEL ? "OpenAI key: not required in mock mode" : process.env.OPENAI_API_KEY ? "OpenAI key: loaded" : "OpenAI key: missing");
  if (process.send) process.send({ type: "listening", host: HOST, port: listenPort });
});

function publicConfig() {
  const publicBaseUrl = PUBLIC_PROXY_BASE_URL || `http://${HOST}:${listeningPort()}`;
  return {
    mode: process.env.SYMPTOMMATE_AI_MODE || "llm",
    proxyEndpoint: `${publicBaseUrl}/api/ai/understand`,
    healthEndpoint: `${publicBaseUrl}/api/health`,
    model: MODEL,
    apiMode: API_MODE,
    baseUrl: BASE_URL,
    modelTimeoutMs: MODEL_TIMEOUT_MS,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    requiresBetaCode: Boolean(BETA_CODE),
    ragEnabled: RAG_ENABLED,
    knowledgeBaseSize: KNOWLEDGE_BASE.length,
    knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
  };
}

async function handleUnderstand(req, res) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  const payload = await readJsonBody(req, 64 * 1024);
  const validation = validateProxyPayload(payload);
  if (!validation.valid) {
    logProxyEvent({ requestId, proxyStatus: "invalid_payload", startedAt, validationIssues: validation.issues });
    sendJson(res, 400, { error: "invalid_payload", issues: validation.issues, requestId });
    return;
  }

  if (!authorizedBetaRequest(req)) {
    logProxyEvent({ requestId, proxyStatus: "unauthorized_beta", startedAt });
    sendJson(res, 401, { error: "unauthorized_beta", requestId });
    return;
  }

  if (!IS_MOCK_MODEL && !process.env.OPENAI_API_KEY) {
    logProxyEvent({ requestId, proxyStatus: "missing_api_key", startedAt });
    sendJson(res, 500, { error: "missing_openai_api_key", requestId });
    return;
  }

  let extraction;
  let modelLatencyMs = 0;
  try {
    const modelStartedAt = Date.now();
    extraction = normalizeExtraction(await callModel(payload), payload);
    modelLatencyMs = Date.now() - modelStartedAt;
  } catch (error) {
    logProxyEvent({ requestId, proxyStatus: "model_call_failed", startedAt, modelLatencyMs, error: error.message });
    sendJson(res, 502, { error: "model_call_failed", requestId });
    return;
  }

  const extractionValidation = validateExtraction(extraction, payload);
  if (!extractionValidation.valid) {
    logProxyEvent({
      requestId,
      proxyStatus: "invalid_model_output",
      startedAt,
      modelLatencyMs,
      validationIssues: extractionValidation.issues,
    });
    sendJson(res, 502, { error: "invalid_model_output", issues: extractionValidation.issues, requestId });
    return;
  }

  logProxyEvent({ requestId, proxyStatus: "ok", startedAt, modelLatencyMs, payload, extraction });
  sendJson(res, 200, { extraction, requestId, proxyStatus: "ok" });
}

async function callModel(payload) {
  if (IS_MOCK_MODEL) return callMockModel(payload);
  if (API_MODE === "chat_completions") return callChatCompletions(payload);
  return callResponses(payload);
}

async function callMockModel(payload) {
  const userInput = String(payload.userInput || "");
  const symptom = firstIncludedValue(userInput, payload.allowedValues.symptoms || []);
  const redFlag = firstIncludedValue(userInput, payload.allowedValues.redFlagKeywords || []);

  return {
    symptom,
    redFlag,
    normalizedText: userInput.trim(),
    extracted: {
      duration: userInput.includes("半小时") ? "半小时" : "",
      severity: "",
      group: payload.currentContext?.selectedGroup || "",
      associatedSymptoms: redFlag ? [redFlag] : [],
    },
    confidence: symptom || redFlag ? 0.94 : 0.21,
  };
}

async function callResponses(payload) {
  const systemPrompt = [
    "You extract structured information for a Chinese symptom self-check assistant.",
    "Only extract and normalize information that appears in the user input or current context.",
    "Do not diagnose diseases, prescribe medicine, provide treatment plans, or decide urgency/risk color.",
    "Return empty strings when the text does not clearly support a field.",
    "For symptom and group, use only the allowed values from the payload.",
    "For redFlag, use only an exact allowed redFlagKeywords value when clearly present or directly implied by the same wording.",
  ].join("\n");
  const ragContext = buildRagContext(payload);

  const response = await fetchWithTimeout(
    `${BASE_URL}/responses`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: JSON.stringify(redactPayload(payload)) },
              ...(ragContext ? [{ type: "input_text", text: ragContext }] : []),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "symptom_self_check_extraction",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
    },
    MODEL_TIMEOUT_MS,
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[ai-proxy] model error", response.status, body.error?.message || body);
    throw new Error(`model_${response.status}`);
  }

  const text = extractResponseText(body);
  if (!text) throw new Error("empty_model_output");
  return parseJsonModelOutput(text);
}

async function callChatCompletions(payload) {
  const systemPrompt = [
    "You extract structured information for a Chinese symptom self-check assistant.",
    "Return only a valid JSON object. Do not wrap it in Markdown.",
    "The JSON object must contain symptom, redFlag, normalizedText, extracted, and confidence.",
    "extracted must contain duration, severity, group, and associatedSymptoms.",
    "Only extract and normalize information that appears in the user input or current context.",
    "Do not diagnose diseases, prescribe medicine, provide treatment plans, or decide urgency/risk color.",
    "Use empty strings when the text does not clearly support a field.",
    "For symptom and group, use only the allowed values from the payload.",
    "For redFlag, use only an exact allowed redFlagKeywords value when clearly present.",
  ].join("\n");
  const ragContext = buildRagContext(payload);

  const response = await fetchWithTimeout(
    `${BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [JSON.stringify(redactPayload(payload)), ragContext].filter(Boolean).join("\n\n"),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        stream: false,
      }),
    },
    MODEL_TIMEOUT_MS,
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[ai-proxy] model error", response.status, body.error?.message || body);
    throw new Error(`model_${response.status}`);
  }

  const text = body.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("empty_model_output");
  return parseJsonModelOutput(text);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonModelOutput(text) {
  const trimmed = String(text || "").trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(withoutFence);
}

function extractResponseText(body) {
  if (typeof body.output_text === "string") return body.output_text;
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function redactPayload(payload) {
  return {
    ...payload,
    userInput: payload.userInput,
    currentContext: payload.currentContext,
  };
}

function buildRagContext(payload) {
  if (!RAG_ENABLED || !KNOWLEDGE_BASE.length) return "";
  const query = `${payload.userInput || ""} ${payload.currentContext?.selectedGroup || ""} ${payload.task || ""}`;
  const matches = RAG.retrieveKnowledge(query, KNOWLEDGE_BASE, 4);
  if (!matches.length) return "";
  return [
    "Reference context from local documentation only. Do not override local medical rules or safety logic.",
    RAG.formatKnowledgeContext(matches),
  ].join("\n\n");
}

function hashKnowledgeBase(chunks) {
  const json = JSON.stringify(chunks.map((item) => [item.source, item.heading, item.text]));
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function normalizeExtraction(extraction, payload) {
  const safe = extraction && typeof extraction === "object" ? extraction : {};
  const extracted = safe.extracted && typeof safe.extracted === "object" ? safe.extracted : {};
  return {
    symptom: pickAllowed(safe.symptom, payload.allowedValues.symptoms),
    redFlag: pickAllowed(safe.redFlag, payload.allowedValues.redFlagKeywords),
    normalizedText: cleanText(safe.normalizedText || payload.userInput),
    extracted: {
      duration: cleanText(extracted.duration),
      severity: cleanText(extracted.severity),
      group: pickAllowed(extracted.group || safe.group || payload.currentContext?.selectedGroup, payload.allowedValues.groups || []),
      associatedSymptoms: Array.isArray(extracted.associatedSymptoms)
        ? extracted.associatedSymptoms.map(cleanText).filter(Boolean).slice(0, 8)
        : [],
    },
    confidence: clampConfidence(safe.confidence),
  };
}

function validateExtraction(extraction, payload) {
  const issues = [];
  if (!extraction.symptom && !extraction.redFlag) issues.push("model did not extract an allowed symptom or red flag");
  if (hasForbiddenClinicalOutput(extraction)) issues.push("model output contains forbidden clinical fields");
  if (extraction.symptom && !payload.allowedValues.symptoms.includes(extraction.symptom)) issues.push("symptom is not allowed");
  if (extraction.redFlag && !payload.allowedValues.redFlagKeywords.includes(extraction.redFlag)) issues.push("redFlag is not allowed");
  if (typeof extraction.confidence !== "number" || extraction.confidence < 0 || extraction.confidence > 1) {
    issues.push("confidence must be between 0 and 1");
  }
  return { valid: issues.length === 0, issues };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickAllowed(value, allowedValues) {
  const text = cleanText(value);
  return Array.isArray(allowedValues) && allowedValues.includes(text) ? text : "";
}

function firstIncludedValue(text, allowedValues) {
  return Array.isArray(allowedValues) ? allowedValues.find((value) => text.includes(value)) || "" : "";
}

function clampConfidence(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0.3;
  return Math.max(0, Math.min(1, numberValue));
}

function hasForbiddenClinicalOutput(value) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => FORBIDDEN_OUTPUT_KEYS.includes(key) || hasForbiddenClinicalOutput(value[key]));
}

function createRequestId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function listeningPort() {
  const address = server.address();
  return address && typeof address === "object" ? address.port : PORT;
}

function logProxyEvent({ requestId, proxyStatus, startedAt, modelLatencyMs = 0, payload = {}, extraction = {}, validationIssues = [], error = "" }) {
  const event = {
    event: "ai_understand",
    requestId,
    proxyStatus,
    durationMs: Date.now() - startedAt,
    modelLatencyMs,
    inputLength: payload.userInput?.length || 0,
    symptom: extraction.symptom || "",
    redFlag: extraction.redFlag || "",
    confidence: extraction.confidence ?? "",
    validationIssues,
    error,
    timestamp: new Date().toISOString(),
  };
  writeJsonLog(event);
}

function writeJsonLog(event) {
  const line = `${JSON.stringify(event)}\n`;
  console.log(line.trimEnd());
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch (error) {
    console.error("[ai-proxy] failed to write log", error.message);
  }
}

function validateProxyPayload(payload) {
  const issues = [];
  if (!payload || typeof payload !== "object") issues.push("payload must be an object");
  if (payload?.schemaVersion !== "symptommate.llm-extraction.v1") issues.push("unsupported schemaVersion");
  if (!payload?.userInput || typeof payload.userInput !== "string") issues.push("userInput is required");
  if (payload?.userInput?.length > 1000) issues.push("userInput is too long");
  if (!Array.isArray(payload?.allowedValues?.symptoms)) issues.push("allowed symptoms are required");
  if (!Array.isArray(payload?.allowedValues?.redFlagKeywords)) issues.push("allowed redFlagKeywords are required");
  return { valid: issues.length === 0, issues };
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(ROOT_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Beta-Code");
}

function authorizedBetaRequest(req) {
  if (!BETA_CODE) return true;
  return String(req.headers["x-beta-code"] || "") === BETA_CODE;
}

function loadDotEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
