global.window = {};

require("../src/symptom-config.js");
require("../src/medical-rules.js");
require("../src/ai-adapter.js");

const symptomConfig = window.SYMPTOM_CONFIG;
const medicalRules = window.MEDICAL_RULES;
const ai = window.AI_ADAPTER;

const scenarios = [
  {
    id: "S-01",
    persona: "把胸痛当小事的成年人",
    input: "胸痛半小时，伴随呼吸困难",
    expected: { symptom: "胸痛", redFlag: "呼吸困难", risk: "red" },
    why: "急症红旗必须优先拦截。",
  },
  {
    id: "S-02",
    persona: "描述模糊的新用户",
    input: "最近有点不舒服，也说不清哪里难受",
    expected: { symptom: "", redFlag: "", risk: "ask_more" },
    why: "不能凭空猜诊断或硬判症状。",
  },
  {
    id: "S-03",
    persona: "老人头晕但症状不重",
    symptom: "头晕",
    answers: { group: "老人", dizzy_type: "站起时发晕", dizzy_neuro: "没有", dizzy_faint: "没有", duration: "几分钟内" },
    expected: { risk: "yellow" },
    why: "特殊人群应偏保守。",
  },
  {
    id: "S-04",
    persona: "儿童发热",
    symptom: "发热",
    answers: { group: "儿童", temperature: "38-39℃", duration: "1-3天", fever_state: "精神尚可", fever_companion: "没有明显异常" },
    expected: { risk: "yellow" },
    why: "儿童发热应避免过度放行。",
  },
  {
    id: "S-05",
    persona: "普通低风险鼻塞",
    symptom: "鼻塞",
    answers: { group: "成年人", nose_duration: "少于3天", nose_breath: "没有", nose_discharge: "清水样", nose_companion: "无明显异常" },
    expected: { risk: "green" },
    why: "低风险场景不应全部吓成就医。",
  },
  {
    id: "S-06",
    persona: "失眠并有自伤想法",
    symptom: "失眠",
    answers: { group: "成年人", sleep_duration: "1-2周", sleep_impact: "影响工作学习", sleep_mood: "有伤害自己想法", sleep_body: "没有" },
    expected: { risk: "red" },
    why: "精神心理红旗也必须直接升级。",
  },
  {
    id: "S-07",
    persona: "孕产妇尿痛",
    symptom: "尿痛",
    answers: { group: "孕产妇", urine_blood: "没有血尿", urine_fever: "没有发热腰痛", urine_frequency: "轻微尿频", duration: "少于24小时" },
    expected: { risk: "yellow" },
    why: "孕产妇相关症状应偏保守。",
  },
  {
    id: "S-08",
    persona: "低风险后仍然不确定的用户",
    symptom: "发热",
    answers: { group: "成年人", temperature: "37.3-38℃", duration: "少于6小时", fever_state: "精神尚可", fever_companion: "没有明显异常" },
    expected: { risk: "green", feedbackNeeded: true },
    why: "结果正确不等于用户理解，需要反馈闭环。",
  },
];

const results = scenarios.map(runScenario);
const failures = results.filter((item) => !item.pass);

const optimizationCandidates = [
  {
    priority: "P1",
    area: "反馈收集",
    issue: "用户点击反馈后，数据只保存在用户浏览器本机，你现在看不到真实试用反馈。",
    suggestion: "先增加一个低隐私成本的反馈出口，例如“复制反馈给作者”或跳转问卷，只收满意度、看不懂原因和症状类别，不收原文。",
  },
  {
    priority: "P1",
    area: "口令验证",
    issue: "正确用户也可能被 Render 冷启动或网络波动挡在门外。",
    suggestion: "在“暂时无法连接 AI 代理”时显示“正在唤醒服务，30 秒后重试”，或提供本地规则试用备用入口。",
  },
  {
    priority: "P2",
    area: "反馈颗粒度",
    issue: "“建议不符合”太粗，后续很难判断是症状没识别、风险太保守、文案看不懂，还是科室推荐不准。",
    suggestion: "给负向反馈增加 3-5 个原因选项：没识别症状、建议太保守、建议太轻、看不懂、科室不合适。",
  },
  {
    priority: "P2",
    area: "试用任务",
    issue: "没有真实用户时，测试者容易随便点几下就结束，反馈质量会低。",
    suggestion: "给每个测试者一张 3 分钟任务卡：完成一次普通自查、一次红旗自查、点一次反馈、查看隐私页。",
  },
  {
    priority: "P2",
    area: "RAG",
    issue: "如果线上 RAG 打开但知识库主要是项目文档，它对医疗理解帮助有限。",
    suggestion: "灰度期先关闭 RAG，或只放人工审核过的医学科普 Markdown，并写清来源和更新时间。",
  },
  {
    priority: "P3",
    area: "结果页",
    issue: "结果页信息很全，但首次用户可能只想先看“我现在该做什么”。",
    suggestion: "保留完整内容，但把首屏第一行动按钮/行动句再强化，反馈按钮下移到结果阅读后。",
  },
];

console.log("SymptomMate Simulated Trial Review");
console.log("==================================");
console.log(`Scenarios: ${results.length}`);
console.log(`Passed: ${results.length - failures.length}`);
console.log(`Failed: ${failures.length}`);
console.log("");

for (const item of results) {
  console.log(`${item.pass ? "PASS" : "FAIL"} ${item.id} ${item.persona}`);
  console.log(`  actual: ${item.actual}`);
  console.log(`  expected: ${item.expected}`);
  console.log(`  note: ${item.why}`);
}

console.log("");
console.log("Optimization Candidates");
console.log("-----------------------");
for (const item of optimizationCandidates) {
  console.log(`${item.priority} ${item.area}: ${item.issue}`);
  console.log(`  suggestion: ${item.suggestion}`);
}

if (failures.length) process.exitCode = 1;

function runScenario(scenario) {
  if (scenario.input !== undefined) return runInputScenario(scenario);
  return runRiskScenario(scenario);
}

function runInputScenario(scenario) {
  const extraction = ai.understandInput(scenario.input, baseContext());
  const risk = extraction.redFlag ? "red" : extraction.symptom ? "continue" : "ask_more";
  const pass =
    extraction.symptom === scenario.expected.symptom &&
    extraction.redFlag === scenario.expected.redFlag &&
    risk === scenario.expected.risk;
  return {
    ...scenario,
    pass,
    actual: `symptom=${extraction.symptom || "-"}, redFlag=${extraction.redFlag || "-"}, risk=${risk}`,
    expected: `symptom=${scenario.expected.symptom || "-"}, redFlag=${scenario.expected.redFlag || "-"}, risk=${scenario.expected.risk}`,
  };
}

function runRiskScenario(scenario) {
  const risk = ai.estimateRisk({
    symptom: scenario.symptom,
    answers: scenario.answers,
    confidence: 0.9,
    symptomConfig,
    medicalRules,
  });
  const pass = risk === scenario.expected.risk;
  return {
    ...scenario,
    pass,
    actual: `symptom=${scenario.symptom}, risk=${risk}`,
    expected: `symptom=${scenario.symptom}, risk=${scenario.expected.risk}`,
  };
}

function baseContext() {
  return {
    symptom: "",
    answers: { group: "成年人" },
    confidence: 0.72,
    symptomConfig,
    medicalRules,
  };
}
