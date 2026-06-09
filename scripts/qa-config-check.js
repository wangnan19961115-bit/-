const fs = require("fs");

global.window = {};
require("../src/symptom-config.js");

const config = window.SYMPTOM_CONFIG;
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

if (!config) fail("SYMPTOM_CONFIG 未正确导出");

if (config) {
  if (!Array.isArray(config.symptoms) || config.symptoms.length !== 20) {
    fail(`症状数量应为 20，当前为 ${config.symptoms?.length}`);
  }

  for (const symptom of config.symptoms || []) {
    const profile = config.symptomProfiles?.[symptom];
    const questions = config.symptomQuestions?.[symptom];
    const relatedWords = config.relatedWords?.[symptom];
    const escalationSignals = config.escalationSignalsBySymptom?.[symptom];

    if (!profile) fail(`${symptom}: 缺少 symptomProfiles 配置`);
    if (!Array.isArray(questions)) fail(`${symptom}: 缺少 symptomQuestions 配置`);
    if (!Array.isArray(relatedWords) || relatedWords.length === 0) warn(`${symptom}: relatedWords 为空，可能影响自由输入识别`);
    if (!Array.isArray(escalationSignals) || escalationSignals.length < 3) fail(`${symptom}: 升级处理信号至少需要 3 条`);

    if (profile) {
      for (const key of ["department", "backup", "checks", "care", "questions", "related"]) {
        if (!profile[key] || (Array.isArray(profile[key]) && profile[key].length === 0)) {
          fail(`${symptom}: profile.${key} 缺失或为空`);
        }
      }
    }

    if (questions) {
      if (questions.length !== 5) fail(`${symptom}: 专属追问应为 5 个，当前为 ${questions.length}`);

      let redOptionCount = 0;
      for (const question of questions) {
        for (const key of ["id", "label", "text", "options"]) {
          if (!question[key]) fail(`${symptom}: 问题缺少 ${key}`);
        }
        if (!Array.isArray(question.options) || question.options.length < 3) {
          fail(`${symptom}: ${question.label || question.id} 选项少于 3 个`);
        }
        redOptionCount += question.options.filter((option) => typeof option === "object" && option.red).length;
      }
      if (redOptionCount === 0) fail(`${symptom}: 至少需要 1 个红线选项`);
    }
  }

  const redFlagKeywords = config.redFlagKeywords || [];
  if (redFlagKeywords.length < 10) fail("redFlagKeywords 数量偏少，至少需要 10 个");
}

console.log("SymptomMate QA Config Check");
console.log("===========================");
console.log(`Symptoms: ${config?.symptoms?.length || 0}`);
console.log(`Failures: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length) {
  console.log("\nWarnings:");
  for (const item of warnings) console.log(`- ${item}`);
}

if (failures.length) {
  console.log("\nFailures:");
  for (const item of failures) console.log(`- ${item}`);
  process.exit(1);
}

console.log("\nAll required config checks passed.");
