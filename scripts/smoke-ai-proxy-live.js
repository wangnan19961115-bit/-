const http = require("http");

const port = process.env.AI_PROXY_PORT || 8788;
const host = process.env.AI_PROXY_HOST || "127.0.0.1";
const proxyUrl = process.env.AI_PROXY_URL || `http://${host}:${port}/api/ai/understand`;

const payload = {
  schemaVersion: "symptommate.llm-extraction.v1",
  task: "extract_symptom_self_check_entities",
  locale: "zh-CN",
  userInput: "胸痛半小时，伴随呼吸困难",
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

requestJson(proxyUrl, payload)
  .then((body) => {
    const extraction = body.extraction || {};
    const passed = extraction.symptom === "胸痛" && extraction.redFlag === "呼吸困难";
    console.log("SymptomMate Live AI Proxy Smoke");
    console.log("===============================");
    console.log(JSON.stringify(extraction, null, 2));
    if (!passed) {
      console.log("\nExpected symptom=胸痛 and redFlag=呼吸困难.");
      process.exit(1);
    }
    console.log("\nLive AI proxy smoke passed.");
  })
  .catch((error) => {
    console.error("Live AI proxy smoke failed.");
    console.error(error.message);
    process.exit(1);
  });

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
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("request timeout"));
    });
    req.end(data);
  });
}
