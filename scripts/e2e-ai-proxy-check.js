const http = require("http");

const port = process.env.AI_PROXY_PORT || 8788;
const host = process.env.AI_PROXY_HOST || "127.0.0.1";
const baseUrl = process.env.AI_PROXY_BASE_URL || `http://${host}:${port}`;

const basePayload = {
  schemaVersion: "symptommate.llm-extraction.v1",
  task: "extract_symptom_self_check_entities",
  locale: "zh-CN",
  currentContext: {
    selectedGroup: "成年人",
    currentSymptom: "",
  },
  allowedValues: {
    symptoms: ["胸痛", "头痛", "腹痛", "咳嗽", "发热"],
    groups: ["成年人", "儿童", "老人", "孕产妇", "有基础病"],
    redFlagKeywords: ["呼吸困难", "喘不上气", "剧烈胸痛"],
  },
  outputContract: {},
  safetyRules: [],
};

const checks = [
  {
    id: "E2E-01",
    name: "red flag extraction",
    payload: { ...basePayload, userInput: "胸痛半小时，伴随呼吸困难" },
    assert: ({ status, body }) => status === 200 && body.extraction?.symptom === "胸痛" && body.extraction?.redFlag === "呼吸困难",
  },
  {
    id: "E2E-02",
    name: "vague input is rejected by proxy validation",
    payload: { ...basePayload, userInput: "最近有点不舒服" },
    assert: ({ status, body }) => status === 502 && body.error === "invalid_model_output",
  },
  {
    id: "E2E-03",
    name: "invalid payload rejected before model call",
    payload: { userInput: "胸痛" },
    assert: ({ status, body }) => status === 400 && body.error === "invalid_payload",
  },
];

run()
  .then(() => {
    console.log("SymptomMate AI Proxy E2E");
    console.log("=======================");
    for (const item of checks) console.log(`- ${item.id}: ${item.name}`);
    console.log("\nAll AI proxy E2E checks passed.");
  })
  .catch((error) => {
    console.error("SymptomMate AI Proxy E2E failed.");
    console.error(error.message);
    process.exit(1);
  });

async function run() {
  for (const check of checks) {
    const result = await requestJson(`${baseUrl}/api/ai/understand`, check.payload);
    if (!check.assert(result)) {
      throw new Error(`${check.id} failed: status=${result.status} body=${JSON.stringify(result.body)}`);
    }
  }
}

function requestJson(url, body) {
  const parsedUrl = new URL(url);
  const data = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": data.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode, body: JSON.parse(text) });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("request timeout"));
    });
    req.end(data);
  });
}
