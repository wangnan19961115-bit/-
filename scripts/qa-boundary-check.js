global.window = {};

require("../src/symptom-config.js");
require("../src/medical-rules.js");
require("../src/ai-adapter.js");

const config = window.SYMPTOM_CONFIG;
const ai = window.AI_ADAPTER;

const failures = [];
const passes = [];

function check(id, ok, message) {
  if (ok) {
    passes.push({ id, message });
  } else {
    failures.push({ id, message });
  }
}

function optionText(option) {
  return typeof option === "string" ? option : option.text;
}

function context(symptom = "", answers = {}, confidence = 0.9) {
  return {
    symptom,
    answers,
    confidence,
    symptomConfig: config,
    medicalRules: window.MEDICAL_RULES,
  };
}

function redOptions(symptom) {
  return (config.symptomQuestions[symptom] || []).flatMap((question) =>
    question.options
      .filter((option) => typeof option === "object" && option.red)
      .map((option) => ({ question, option })),
  );
}

function buildResult(symptom, risk, answers = {}) {
  const profile = config.symptomProfiles[symptom] || {};
  return {
    id: Date.now(),
    symptom,
    risk,
    riskName: { red: "红灯", yellow: "黄灯", green: "绿灯" }[risk],
    department: profile.department,
    backup: profile.backup,
    checks: profile.checks || [],
    questions: profile.questions || [],
    related: profile.related || [],
    answers,
  };
}

function run() {
  const input = ai.understandInput("胸痛半小时，伴随呼吸困难", context());
  check("B-01", input.symptom === "胸痛" && input.redFlag.includes("呼吸困难"), "自由输入胸痛伴呼吸困难应识别症状并命中红线词。");

  const vague = ai.understandInput("最近有点不舒服", context());
  check("B-02", !vague.symptom && !vague.redFlag, "模糊输入不应识别为明确主要症状。");

  const anyRed = redOptions("胸痛")[0];
  check("B-03", Boolean(anyRed?.option?.red), `胸痛红线选项“${optionText(anyRed?.option || "")}”应可直接触发红线预警。`);

  const history = [];
  const result = buildResult("发热", "green", {
    temperature: "37.3-38℃",
    duration: "少于6小时",
    fever_state: "精神尚可",
    fever_companion: "没有明显异常",
    group: "成年人",
  });
  history.unshift(result);
  check(
    "B-04",
    history[0]?.symptom === "发热" && history[0]?.riskName === "绿灯" && history[0]?.department === "全科",
    "普通自查完成后历史记录应包含症状、风险等级和推荐科室。",
  );

  const feedback = [];
  feedback.unshift({
    type: "uncertain",
    label: "仍然不确定",
    symptom: result.symptom,
    risk: result.risk,
    resultId: result.id,
  });
  check("B-05", feedback[0]?.type === "uncertain" && feedback[0]?.symptom === "发热", "点击仍然不确定应记录反馈事件。");

  const pages = {
    prep: result.checks.length > 0,
    questions: result.questions.length > 0,
    referral: Boolean(result.symptom && result.riskName && result.department),
  };
  check("B-06", pages.prep && pages.questions && pages.referral, "准备清单、问题清单、转诊单应具备进入对应页面所需数据。");
}

run();

console.log("SymptomMate Boundary Check");
console.log("==========================");
console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${failures.length}`);

if (passes.length) {
  console.log("\nPasses:");
  for (const item of passes) console.log(`- ${item.id}: ${item.message}`);
}

if (failures.length) {
  console.log("\nFailures:");
  for (const item of failures) console.log(`- ${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("\nAll boundary checks passed.");
