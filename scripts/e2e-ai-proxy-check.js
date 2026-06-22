const http = require("http");
const path = require("path");
const { fork } = require("child_process");

const host = process.env.AI_PROXY_HOST || "127.0.0.1";
const betaCode = process.env.SYMPTOMMATE_BETA_CODE || "local-e2e-beta";
let baseUrl = process.env.AI_PROXY_BASE_URL || "";
let proxyProcess = null;

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
  {
    id: "E2E-04",
    name: "wrong beta code is rejected",
    payload: { ...basePayload, userInput: "胸痛半小时，伴随呼吸困难" },
    betaCode: "wrong-beta-code",
    assert: ({ status, body }) => status === 401 && body.error === "unauthorized_beta",
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
  if (!baseUrl) {
    const started = await startMockProxy();
    baseUrl = started.baseUrl;
    proxyProcess = started.child;
  }

  try {
    const rejectedConfig = await requestJson(`${baseUrl}/api/config`, null, "wrong-beta-code", "GET");
    if (rejectedConfig.status !== 401 || rejectedConfig.body?.error !== "unauthorized_beta") {
      throw new Error(`E2E-00 failed: status=${rejectedConfig.status} body=${JSON.stringify(rejectedConfig.body)}`);
    }

    for (const check of checks) {
      const result = await requestJson(`${baseUrl}/api/ai/understand`, check.payload, check.betaCode || betaCode);
      if (!check.assert(result)) {
        throw new Error(`${check.id} failed: status=${result.status} body=${JSON.stringify(result.body)}`);
      }
    }
  } finally {
    stopMockProxy();
  }
}

function startMockProxy() {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, "ai-proxy.js");
    const child = fork(script, {
      cwd: path.resolve(__dirname, ".."),
      silent: true,
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        OPENAI_API_MODE: "mock",
        AI_PROXY_HOST: host,
        AI_PROXY_PORT: "0",
        SYMPTOMMATE_BETA_CODE: betaCode,
      },
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("mock proxy did not start before timeout"));
    }, 10000);

    child.on("message", (message) => {
      if (settled || message?.type !== "listening") return;
      settled = true;
      clearTimeout(timer);
      resolve({
        child,
        baseUrl: `http://${message.host}:${message.port}`,
      });
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`mock proxy exited before listening: ${code}`));
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function stopMockProxy() {
  if (proxyProcess && !proxyProcess.killed) proxyProcess.kill();
}

function requestJson(url, body, code = "", method = "POST") {
  const parsedUrl = new URL(url);
  const data = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": data.length,
          ...(code ? { "X-Beta-Code": code } : {}),
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
    req.end(data.length ? data : undefined);
  });
}
