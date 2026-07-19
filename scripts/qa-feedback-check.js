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
  riskName: "绿灯",
  risk: "green",
  department: "全科",
};

check(typeof context.window.recordFeedback === "function", "recordFeedback should be exported for inline page handlers");
check(typeof context.window.copyFeedbackSummary === "function", "copyFeedbackSummary should be exported for inline page handlers");
check(typeof context.window.createFeedbackSummary === "function", "createFeedbackSummary should be exported for QA and diagnostics");

context.window.recordFeedback("uncertain");
context.window.recordFeedback("detail", "symptom_mismatch");

const feedback = JSON.parse(storage.get("symptomMateFeedback") || "[]");
const events = JSON.parse(storage.get("symptomMateEvents") || "[]");
const summary = context.window.createFeedbackSummary("detail", "symptom_mismatch");

check(feedback.length === 2, "feedback should write local feedback items");
check(feedback[1]?.type === "uncertain", "feedback type should be recorded");
check(feedback[1]?.label === "仍然不确定", "feedback label should be recorded");
check(feedback[1]?.symptom === "发热", "feedback symptom should be copied from the current result");
check(feedback[0]?.risk === "green", "feedback risk should be copied from the current result");
check(feedback[0]?.resultId === 12345, "feedback result id should be copied from the current result");
check(feedback[0]?.reasonId === "symptom_mismatch", "detailed feedback should record a reason id");
check(feedback[0]?.reasonLabel === "症状没识别准", "detailed feedback should record a reason label");
check(feedback[0]?.summary?.includes("不包含用户原始症状输入"), "feedback should store a sanitized summary");
check(events[0]?.type === "feedback", "feedback should also write an analytics event");
check(events[0]?.feedbackType === "detail", "analytics feedback type should match latest feedback");
check(events[0]?.feedbackReason === "symptom_mismatch", "analytics feedback reason should match");
check(summary.includes("SymptomMate 试用反馈"), "summary should include a feedback title");
check(summary.includes("版本: 20260719-4"), "summary should include the app version");
check(summary.includes("症状类别: 发热"), "summary should include symptom category");
check(summary.includes("风险等级: 绿灯"), "summary should include risk name");
check(summary.includes("推荐科室: 全科"), "summary should include department");
check(!summary.includes("userInput"), "summary should not include raw input field names");

console.log("SymptomMate Feedback Check");
console.log("==========================");
console.log(`Feedback items: ${feedback.length}`);
console.log(`Analytics events: ${events.length}`);

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All feedback checks passed.");
