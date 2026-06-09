global.window = {};
require("../src/symptom-config.js");
require("../src/medical-rules.js");

const symptomConfig = window.SYMPTOM_CONFIG;
const medicalRules = window.MEDICAL_RULES;
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function normalizeRuleText(text) {
  return String(text).replace(/[、/，,或和\s]/g, "");
}

if (!symptomConfig) fail("SYMPTOM_CONFIG 未正确导出");
if (!medicalRules) fail("MEDICAL_RULES 未正确导出");

if (symptomConfig && medicalRules) {
  const { symptoms, symptomQuestions, symptomProfiles } = symptomConfig;
  const { rules, commonForbiddenOutputs, commonDisclaimers } = medicalRules;

  if (!Array.isArray(commonForbiddenOutputs) || commonForbiddenOutputs.length < 5) {
    fail("commonForbiddenOutputs 至少需要 5 条");
  }

  if (!Array.isArray(commonDisclaimers) || commonDisclaimers.length < 3) {
    fail("commonDisclaimers 至少需要 3 条");
  }

  for (const symptom of symptoms) {
    const rule = rules?.[symptom];
    const questions = symptomQuestions?.[symptom] || [];
    const profile = symptomProfiles?.[symptom];

    if (!rule) {
      fail(`${symptom}: 缺少 medical rule`);
      continue;
    }

    for (const key of ["redRules", "yellowRules", "greenRules", "forbiddenOutputs"]) {
      if (!Array.isArray(rule[key]) || rule[key].length === 0) {
        fail(`${symptom}: ${key} 缺失或为空`);
      }
    }

    for (const key of ["followUpPurpose", "departmentRationale"]) {
      if (!rule[key] || typeof rule[key] !== "string") {
        fail(`${symptom}: ${key} 缺失`);
      }
    }

    const redOptions = questions
      .flatMap((question) => question.options)
      .filter((option) => typeof option === "object" && option.red)
      .map((option) => option.text);

    if (redOptions.length === 0) {
      fail(`${symptom}: symptomQuestions 中没有红线选项`);
    }

    const unmatchedRedOptions = redOptions.filter((option) => {
      const normalizedOption = normalizeRuleText(option);
      return !rule.redRules.some((ruleText) => {
        const normalizedRule = normalizeRuleText(ruleText);
        return normalizedRule.includes(normalizedOption) || normalizedOption.includes(normalizedRule);
      });
    });
    if (unmatchedRedOptions.length > Math.ceil(redOptions.length / 2)) {
      warn(`${symptom}: 多个红线选项未在 redRules 中体现：${unmatchedRedOptions.join("、")}`);
    }

    if (profile?.department && !rule.departmentRationale.includes(profile.department)) {
      warn(`${symptom}: departmentRationale 未直接提到主推荐科室 ${profile.department}`);
    }
  }
}

console.log("SymptomMate Medical Rules Check");
console.log("===============================");
console.log(`Symptoms: ${symptomConfig?.symptoms?.length || 0}`);
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

console.log("\nAll required medical rule checks passed.");
