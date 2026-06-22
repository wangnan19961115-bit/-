const vm = require("vm");
const fs = require("fs");

const files = ["src/symptom-config.js", "src/medical-rules.js", "src/ai-adapter.js", "src/app.js"];
const storage = new Map();
const sessionStorageData = new Map([["symptomMateBetaCode", "local-e2e-beta"]]);
const timers = [];

const document = {
  elements: {},
  querySelector(selector) {
    if (selector === "#app") return this.elements.app;
    if (selector === "#chatInput") return this.elements.chatInput;
    return null;
  },
};

document.elements.app = {
  innerHTML: "",
};

document.elements.chatInput = {
  value: "",
};

const windowObject = {
  SYMPTOMMATE_AI_CONFIG: {
    mode: "llm",
    proxyEndpoint: "http://127.0.0.1:8788/api/ai/understand",
    healthEndpoint: "http://127.0.0.1:8788/api/health",
    configEndpoint: "http://127.0.0.1:8788/api/config",
    timeoutMs: 7000,
    betaCodeStorageKey: "symptomMateBetaCode",
  },
  location: {
    search: "?ai=shadow",
  },
  setTimeout(fn) {
    timers.push(fn);
    return timers.length;
  },
  clearTimeout() {},
  requestAnimationFrame(fn) {
    fn();
  },
  scrollTo() {},
};

const context = {
  window: windowObject,
  document,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  },
  sessionStorage: {
    getItem(key) {
      return sessionStorageData.has(key) ? sessionStorageData.get(key) : null;
    },
    setItem(key, value) {
      sessionStorageData.set(key, String(value));
    },
    removeItem(key) {
      sessionStorageData.delete(key);
    },
  },
  fetch,
  AbortController,
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Promise,
};

context.globalThis = context;

for (const file of files) {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

run()
  .then(() => {
    console.log("SymptomMate Browser E2E");
    console.log("=======================");
    console.log("- BROWSER-01: red flag free text reaches alert view");
    console.log("- BROWSER-02: AI debug panel health check works");
    console.log("\nAll browser E2E checks passed.");
  })
  .catch((error) => {
    console.error("SymptomMate Browser E2E failed.");
    console.error(error.message);
    process.exit(1);
  });

async function run() {
  windowObject.openConsent();
  windowObject.state.consentChecked = true;
  windowObject.confirmConsent();
  document.elements.chatInput.value = "胸痛半小时，伴随呼吸困难";
  await windowObject.submitFreeText({ preventDefault() {} });
  assert(windowObject.state.view === "alert", "expected alert view after red flag input");
  assert(windowObject.state.result?.risk === "red", "expected red risk result");

  windowObject.setView("mine", "mine");
  await windowObject.checkAiDebug();
  assert(windowObject.state.aiDebug.health?.ok === true, "expected AI health check to pass");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
