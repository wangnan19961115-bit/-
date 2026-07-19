global.window = {};

require("../src/symptom-config.js");
require("../src/medical-rules.js");
require("../src/ai-config.js");
require("../src/ai-adapter.js");

const symptomConfig = window.SYMPTOM_CONFIG;
const medicalRules = window.MEDICAL_RULES;
const aiAdapter = window.AI_ADAPTER;

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const context = {
  symptom: "",
  answers: { group: "成年人" },
  confidence: 0.72,
  symptomConfig,
  medicalRules,
};

const redFlagCases = [
  { input: "胸痛半小时，伴随呼吸困难", redFlag: "呼吸困难" },
  { input: "突然剧烈头痛，说话不清楚", redFlag: "突然剧烈头痛" },
  { input: "孩子高热不退，还出现抽搐", redFlag: "抽搐" },
  { input: "腹痛后开始呕血", redFlag: "呕血" },
  { input: "胸口痛，喘不上气", redFlag: "喘不上气" },
];

for (const item of redFlagCases) {
  const result = aiAdapter.understandInput(item.input, context);
  check(result.redFlag === item.redFlag, `${item.input}: should extract red flag ${item.redFlag}, got ${result.redFlag || "(empty)"}`);
}

const vague = aiAdapter.understandInput("最近有点不舒服，也说不清哪里难受", context);
check(!vague.symptom && !vague.redFlag, "vague input should not invent a symptom or red flag");

const forbidden = aiAdapter.integration.validateUnderstanding(
  {
    symptom: "发热",
    redFlag: "",
    normalizedText: "发热两天",
    extracted: { duration: "两天", severity: "", group: "成年人", associatedSymptoms: [] },
    confidence: 0.8,
    diagnosis: "流感",
  },
  context,
);
check(!forbidden.valid && forbidden.issues.some((issue) => issue.includes("诊断")), "adapter should reject forbidden diagnosis output");

check(symptomConfig.redFlagKeywords.includes("呼吸困难"), "redFlagKeywords should include 呼吸困难");
check(symptomConfig.redFlagKeywords.includes("意识不清"), "redFlagKeywords should include 意识不清");
check(symptomConfig.redFlagKeywords.includes("突发剧烈头痛"), "redFlagKeywords should include 突发剧烈头痛");
check(symptomConfig.redFlagKeywords.includes("突然剧烈头痛"), "redFlagKeywords should include 突然剧烈头痛");
check(Array.isArray(medicalRules.commonDisclaimers) && medicalRules.commonDisclaimers.length > 0, "medical rules should keep common disclaimers");
check(Array.isArray(medicalRules.commonForbiddenOutputs) && medicalRules.commonForbiddenOutputs.length > 0, "medical rules should keep forbidden output boundaries");

console.log("SymptomMate Medical Safety Check");
console.log("================================");
console.log(`Red flag cases: ${redFlagCases.length}`);

if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All medical safety checks passed.");
