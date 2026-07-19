const fs = require("fs");
const vm = require("vm");

const storage = new Map();
const timers = [];
const appElement = { innerHTML: "" };

const context = {
  window: {
    SYMPTOMMATE_AI_CONFIG: {
      mode: "simulated",
      betaCodeStorageKey: "symptomMateBetaCode",
    },
    location: {
      search: "",
      protocol: "https:",
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
  },
  document: {
    querySelector(selector) {
      if (selector === "#app") return appElement;
      return null;
    },
  },
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
    getItem() {
      return "";
    },
    setItem() {},
    removeItem() {},
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

for (const file of ["src/symptom-config.js", "src/medical-rules.js", "src/ai-config.js", "src/ai-adapter.js", "src/app.js"]) {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

context.window.state.result = {
  id: 12345,
  symptom: "发热",
  risk: "green",
};

check(typeof context.window.recordFeedback === "function", "recordFeedback should be exported for inline page handlers");

context.window.recordFeedback("uncertain");

const feedback = JSON.parse(storage.get("symptomMateFeedback") || "[]");
const events = JSON.parse(storage.get("symptomMateEvents") || "[]");

check(feedback.length === 1, "feedback should write one local feedback item");
check(feedback[0]?.type === "uncertain", "feedback type should be recorded");
check(feedback[0]?.label === "仍然不确定", "feedback label should be recorded");
check(feedback[0]?.symptom === "发热", "feedback symptom should be copied from the current result");
check(feedback[0]?.risk === "green", "feedback risk should be copied from the current result");
check(feedback[0]?.resultId === 12345, "feedback result id should be copied from the current result");
check(events[0]?.type === "feedback", "feedback should also write an analytics event");
check(events[0]?.feedbackType === "uncertain", "analytics feedback type should match");

console.log("SymptomMate Feedback Check");
console.log("==========================");
console.log(`Feedback items: ${feedback.length}`);
console.log(`Analytics events: ${events.length}`);

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All feedback checks passed.");
