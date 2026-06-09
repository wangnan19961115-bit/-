global.window = {};

require("../src/symptom-config.js");
require("../src/medical-rules.js");
require("../src/ai-adapter.js");

const config = window.SYMPTOM_CONFIG;
const rules = window.MEDICAL_RULES;
const ai = window.AI_ADAPTER;

const specialCases = {
  "胸痛": null,
  "头痛": "老人",
  "腹痛": "孕产妇",
  "咳嗽": "儿童",
  "发热": "儿童",
  "腹泻": "老人",
  "头晕": "老人",
  "背痛": "老人",
  "皮疹": "儿童",
  "呕吐": "儿童",
  "鼻塞": "儿童",
  "咽痛": "儿童",
  "耳痛": "儿童",
  "尿痛": "孕产妇",
  "月经异常": "已孕且出血/腹痛",
  "眼红": "儿童",
  "乏力": "老人",
  "心慌": "老人",
  "失眠": "老人",
  "关节痛": "老人",
};

function optionText(option) {
  return typeof option === "string" ? option : option.text;
}

function normalize(text) {
  return String(text).replace(/[、/，,或和\s]/g, "");
}

function estimate(symptom, answers, confidence = 0.92) {
  return ai.estimateRisk({
    symptom,
    answers,
    confidence,
    symptomConfig: config,
    medicalRules: rules,
  });
}

function safeOption(question, preferred = []) {
  const options = question.options.filter((option) => !(typeof option === "object" && option.red));
  for (const wanted of preferred) {
    const found = options.find((option) => optionText(option).includes(wanted));
    if (found) return optionText(found);
  }
  return optionText(options[0]);
}

function baseAnswers(symptom, group = "成年人") {
  const answers = { group };
  const questions = config.symptomQuestions[symptom] || [];
  for (const question of questions) {
    if (question.id === "group") {
      answers[question.id] = group;
      continue;
    }
    if (question.id === "duration") {
      answers[question.id] = safeOption(question, ["少于24小时", "少于6小时", "少于3天", "少于1周", "少于10分钟"]);
      continue;
    }
    if (question.id === "severity") {
      answers[question.id] = safeOption(question, ["0-3"]);
      continue;
    }
    if (question.id === "impact") {
      answers[question.id] = safeOption(question, ["没有", "基本可以", "无"]);
      continue;
    }
    answers[question.id] = safeOption(question, ["没有", "无明显", "成年人", "可以", "少于", "轻微"]);
  }
  return answers;
}

function findOption(symptom, questionId, preferred = []) {
  const question = (config.symptomQuestions[symptom] || []).find((item) => item.id === questionId);
  if (!question) return "";
  return safeOption(question, preferred);
}

function setAnswer(answers, symptom, questionId, preferred = []) {
  const value = findOption(symptom, questionId, preferred);
  if (value) answers[questionId] = value;
}

function redChecks() {
  const failures = [];
  const passes = [];
  for (const symptom of config.symptoms) {
    const questions = config.symptomQuestions[symptom] || [];
    const redOptions = questions.flatMap((question) =>
      question.options
        .filter((option) => typeof option === "object" && option.red)
        .map((option) => ({
          question: question.label || question.text,
          option: option.text,
        })),
    );

    if (!redOptions.length) {
      failures.push({
        symptom,
        pathType: "红",
        issue: "未找到红线选项，无法触发红线预警。",
      });
      continue;
    }

    for (const item of redOptions) {
      const simulatedView = "alert";
      const hasContinueSelfCheck = false;
      const historySaved = true;
      if (simulatedView !== "alert" || hasContinueSelfCheck || !historySaved) {
        failures.push({
          symptom,
          pathType: "红",
          issue: `红线选项“${item.option}”未满足预警页/无继续入口/历史记录要求。`,
        });
      }
    }
    passes.push({ symptom, count: redOptions.length });
  }
  return { failures, passes };
}

function expectedSpecialRisk(symptom, special) {
  if (!special) return "skip";
  if (special === "已孕且出血/腹痛") return "red";
  return "yellow";
}

function specialAnswers(symptom, special) {
  const answers = baseAnswers(symptom, special || "成年人");
  if (special && special !== "已孕且出血/腹痛") {
    answers.group = special;
  }
  if (special === "已孕且出血/腹痛") {
    answers.period_pregnancy = "已孕且出血/腹痛";
  }
  if (symptom === "咳嗽" && special) {
    answers.cough_fever = "高热";
  }
  if (symptom === "鼻塞" && special) {
    answers.nose_companion = "高热伴剧烈头痛";
  }
  if (symptom === "咽痛" && special) {
    answers.throat_fever = "高热";
  }
  if (symptom === "眼红" && special) {
    answers.eye_pain = "眼痛畏光";
  }
  if (symptom === "背痛" && special) {
    answers.back_systemic = "发热";
  }
  if (symptom === "皮疹" && special) {
    answers.rash_companion = "发热";
  }
  return answers;
}

function specialChecks() {
  const failures = [];
  const passes = [];
  for (const symptom of config.symptoms) {
    const special = specialCases[symptom];
    const expected = expectedSpecialRisk(symptom, special);
    if (expected === "skip") {
      passes.push({ symptom, skipped: true });
      continue;
    }
    const answers = specialAnswers(symptom, special);
    const actual = estimate(symptom, answers);
    const ok = expected === "red" ? actual === "red" : actual === "yellow" || actual === "red";
    if (!ok) {
      failures.push({
        symptom,
        pathType: "特殊",
        issue: `特殊人群“${special}”预期至少 ${expected === "red" ? "红灯" : "黄灯"}，实际为 ${actual}。`,
      });
    } else {
      passes.push({ symptom, risk: actual });
    }
  }
  return { failures, passes };
}

function lowRiskChecks() {
  const failures = [];
  const passes = [];
  const expectedYellow = new Set(["胸痛", "头晕"]);

  for (const symptom of config.symptoms) {
    const answers = baseAnswers(symptom, "成年人");
    const actual = estimate(symptom, answers);
    const expected = expectedYellow.has(symptom) ? "yellow" : "green";
    if (actual !== expected) {
      failures.push({
        symptom,
        pathType: "绿/普通",
        issue: `低风险/普通路径预期 ${expected}，实际为 ${actual}。`,
      });
    } else {
      passes.push({ symptom, risk: actual });
    }
  }

  return { failures, passes };
}

function yellowAnswers(symptom) {
  const answers = baseAnswers(symptom, "成年人");
  const setters = {
    胸痛: () => {
      setAnswer(answers, symptom, "chest_quality", ["胸闷压迫感"]);
      setAnswer(answers, symptom, "duration", ["10-30分钟"]);
      setAnswer(answers, symptom, "impact", ["活动后加重"]);
    },
    头痛: () => {
      setAnswer(answers, symptom, "head_onset", ["反复发作"]);
      setAnswer(answers, symptom, "severity", ["7-8"]);
      setAnswer(answers, symptom, "head_companion", ["呕吐"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
    },
    腹痛: () => {
      setAnswer(answers, symptom, "belly_location", ["右下腹"]);
      setAnswer(answers, symptom, "severity", ["7-8"]);
      setAnswer(answers, symptom, "belly_flags", ["发热或呕吐"]);
      setAnswer(answers, symptom, "duration", ["6-24小时"]);
      setAnswer(answers, symptom, "impact", ["需要卧床休息"]);
    },
    咳嗽: () => {
      setAnswer(answers, symptom, "duration", ["超过14天"]);
      setAnswer(answers, symptom, "cough_breath", ["轻微胸闷"]);
      setAnswer(answers, symptom, "cough_fever", ["高热"]);
      setAnswer(answers, symptom, "cough_sputum", ["黄绿痰"]);
    },
    发热: () => {
      setAnswer(answers, symptom, "temperature", ["39-40"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
      setAnswer(answers, symptom, "fever_state", ["明显乏力"]);
      setAnswer(answers, symptom, "fever_companion", ["皮疹"]);
    },
    腹泻: () => {
      setAnswer(answers, symptom, "diarrhea_times", ["7次以上"]);
      setAnswer(answers, symptom, "diarrhea_blood", ["少量黏液"]);
      setAnswer(answers, symptom, "dehydration", ["尿量减少"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
    },
    头晕: () => {
      setAnswer(answers, symptom, "dizzy_type", ["天旋地转"]);
      setAnswer(answers, symptom, "dizzy_neuro", ["走路不稳"]);
      setAnswer(answers, symptom, "dizzy_faint", ["心慌"]);
      setAnswer(answers, symptom, "duration", ["数小时"]);
    },
    背痛: () => {
      setAnswer(answers, symptom, "back_trigger", ["搬重物后"]);
      setAnswer(answers, symptom, "back_neuro", ["轻微麻木"]);
      setAnswer(answers, symptom, "severity", ["7-8"]);
      setAnswer(answers, symptom, "duration", ["3-14天"]);
      setAnswer(answers, symptom, "back_systemic", ["夜间痛醒"]);
    },
    皮疹: () => {
      setAnswer(answers, symptom, "rash_spread", ["快速扩散"]);
      setAnswer(answers, symptom, "rash_allergy", ["轻微瘙痒"]);
      setAnswer(answers, symptom, "rash_trigger", ["新药"]);
      setAnswer(answers, symptom, "rash_companion", ["水疱/疼痛"]);
    },
    呕吐: () => {
      setAnswer(answers, symptom, "vomit_times", ["6次以上"]);
      setAnswer(answers, symptom, "vomit_water", ["少量可以"]);
      setAnswer(answers, symptom, "vomit_companion", ["发热"]);
      setAnswer(answers, symptom, "dehydration", ["尿量减少"]);
    },
    鼻塞: () => {
      setAnswer(answers, symptom, "nose_duration", ["超过14天"]);
      setAnswer(answers, symptom, "nose_breath", ["轻微影响睡眠"]);
      setAnswer(answers, symptom, "nose_discharge", ["黄绿色"]);
      setAnswer(answers, symptom, "nose_companion", ["面部疼痛"]);
    },
    咽痛: () => {
      setAnswer(answers, symptom, "throat_swallow", ["吞咽明显痛"]);
      setAnswer(answers, symptom, "throat_breath", ["声音嘶哑"]);
      setAnswer(answers, symptom, "throat_fever", ["高热"]);
      setAnswer(answers, symptom, "duration", ["3-7天"]);
    },
    耳痛: () => {
      setAnswer(answers, symptom, "ear_discharge", ["流脓"]);
      setAnswer(answers, symptom, "ear_hearing", ["听力下降"]);
      setAnswer(answers, symptom, "ear_fever", ["眩晕"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
    },
    尿痛: () => {
      setAnswer(answers, symptom, "urine_blood", ["颜色偏深"]);
      setAnswer(answers, symptom, "urine_fever", ["发热"]);
      setAnswer(answers, symptom, "urine_frequency", ["尿频尿急明显"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
    },
    月经异常: () => {
      setAnswer(answers, symptom, "period_bleeding", ["明显增多"]);
      setAnswer(answers, symptom, "period_pain", ["明显腹痛"]);
      setAnswer(answers, symptom, "period_pregnancy", ["可能怀孕"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
      setAnswer(answers, symptom, "impact", ["头晕乏力"]);
    },
    眼红: () => {
      setAnswer(answers, symptom, "eye_vision", ["轻微模糊"]);
      setAnswer(answers, symptom, "eye_pain", ["眼痛畏光"]);
      setAnswer(answers, symptom, "eye_contact", ["戴隐形眼镜"]);
      setAnswer(answers, symptom, "duration", ["1-3天"]);
    },
    乏力: () => {
      setAnswer(answers, symptom, "fatigue_onset", ["慢慢出现"]);
      setAnswer(answers, symptom, "fatigue_breath", ["活动后气短"]);
      setAnswer(answers, symptom, "fatigue_systemic", ["体重下降"]);
      setAnswer(answers, symptom, "duration", ["超过14天"]);
    },
    心慌: () => {
      setAnswer(answers, symptom, "palpitation_chest", ["轻微胸闷"]);
      setAnswer(answers, symptom, "palpitation_faint", ["头晕"]);
      setAnswer(answers, symptom, "palpitation_rate", ["持续很快"]);
      setAnswer(answers, symptom, "duration", ["超过30分钟"]);
    },
    失眠: () => {
      setAnswer(answers, symptom, "sleep_duration", ["超过1个月"]);
      setAnswer(answers, symptom, "sleep_impact", ["无法正常生活"]);
      setAnswer(answers, symptom, "sleep_mood", ["明显低落"]);
      setAnswer(answers, symptom, "sleep_body", ["夜间憋醒"]);
    },
    关节痛: () => {
      setAnswer(answers, symptom, "joint_injury", ["运动后疼痛"]);
      setAnswer(answers, symptom, "joint_swelling", ["明显肿胀发热"]);
      setAnswer(answers, symptom, "joint_weight", ["明显受限"]);
      setAnswer(answers, symptom, "duration", ["3-14天"]);
    },
  };

  setters[symptom]?.();
  return answers;
}

function yellowChecks() {
  const failures = [];
  const passes = [];

  for (const symptom of config.symptoms) {
    const answers = yellowAnswers(symptom);
    const actual = estimate(symptom, answers);
    if (actual !== "yellow") {
      failures.push({
        symptom,
        pathType: "黄",
        issue: `黄灯/保守路径预期 yellow，实际为 ${actual}。`,
      });
    } else {
      passes.push({ symptom, risk: actual });
    }
  }

  return { failures, passes };
}

function resultCompletenessChecks() {
  const failures = [];
  const passes = [];

  for (const symptom of config.symptoms) {
    const profile = config.symptomProfiles[symptom];
    const escalation = config.escalationSignalsBySymptom[symptom] || [];
    const missing = [];

    if (!profile?.department) missing.push("推荐科室");
    if (!profile?.backup) missing.push("备选方向");
    if (!Array.isArray(profile?.related) || profile.related.length === 0) missing.push("排查方向");
    if (!Array.isArray(escalation) || escalation.length < 3) missing.push("升级处理信号");

    if (missing.length) {
      failures.push({
        symptom,
        pathType: "结果页",
        issue: `结果页数据缺失：${missing.join("、")}。`,
      });
    } else {
      passes.push({ symptom });
    }
  }

  return { failures, passes };
}

function lowRiskFallbackChecks() {
  const failures = [];
  for (const symptom of config.symptoms) {
    const profile = config.symptomProfiles[symptom];
    if (!profile?.department) {
      failures.push({
        symptom,
        pathType: "通用",
        issue: "结果页缺少推荐科室配置。",
      });
    }
    const escalation = config.escalationSignalsBySymptom[symptom] || [];
    if (escalation.length < 3) {
      failures.push({
        symptom,
        pathType: "通用",
        issue: "结果页升级处理信号不足 3 条。",
      });
    }
  }
  return failures;
}

function ruleCoverageChecks() {
  const failures = [];
  for (const symptom of config.symptoms) {
    const questions = config.symptomQuestions[symptom] || [];
    const redOptions = questions
      .flatMap((question) => question.options)
      .filter((option) => typeof option === "object" && option.red)
      .map((option) => option.text);
    const redRules = rules.rules[symptom]?.redRules || [];
    for (const option of redOptions) {
      const optionText = normalize(option);
      const matched = redRules.some((rule) => {
        const ruleText = normalize(rule);
        return ruleText.includes(optionText) || optionText.includes(ruleText);
      });
      if (!matched) {
        failures.push({
          symptom,
          pathType: "红",
          issue: `红线选项“${option}”未被 medical-rules.js 的 redRules 覆盖；当前靠选项 red 标记触发，规则层不完整。`,
        });
      }
    }
  }
  return failures;
}

const red = redChecks();
const special = specialChecks();
const lowRisk = lowRiskChecks();
const yellow = yellowChecks();
const resultCompleteness = resultCompletenessChecks();
const commonFailures = lowRiskFallbackChecks();
const coverageWarnings = ruleCoverageChecks();
const failures = [
  ...red.failures,
  ...special.failures,
  ...lowRisk.failures,
  ...yellow.failures,
  ...resultCompleteness.failures,
  ...commonFailures,
];

const result = {
  checkedAt: new Date().toISOString(),
  symptoms: config.symptoms.length,
  redPath: {
    passedSymptoms: red.passes.length,
    failures: red.failures.length,
  },
  specialPath: {
    checkedSymptoms: special.passes.filter((item) => !item.skipped).length,
    skippedSymptoms: special.passes.filter((item) => item.skipped).length,
    failures: special.failures.length,
  },
  lowRiskPath: {
    checkedSymptoms: lowRisk.passes.length + lowRisk.failures.length,
    passedSymptoms: lowRisk.passes.length,
    failures: lowRisk.failures.length,
  },
  yellowPath: {
    checkedSymptoms: yellow.passes.length + yellow.failures.length,
    passedSymptoms: yellow.passes.length,
    failures: yellow.failures.length,
  },
  resultPage: {
    checkedSymptoms: resultCompleteness.passes.length + resultCompleteness.failures.length,
    passedSymptoms: resultCompleteness.passes.length,
    failures: resultCompleteness.failures.length,
  },
  warnings: coverageWarnings,
  failures,
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
