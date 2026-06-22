// SymptomMate AI adapter.
// The model only extracts user-input entities. Local rules still decide risk.
(function () {
  const LLM_SCHEMA_VERSION = "symptommate.llm-extraction.v1";
  const DEFAULT_PROXY_ENDPOINT = "http://127.0.0.1:8788/api/ai/understand";
  const DEFAULT_BETA_CODE_STORAGE_KEY = "symptomMateBetaCode";
  const ALLOWED_GROUPS = ["成年人", "儿童", "老人", "孕产妇", "有基础病"];
  const FORBIDDEN_OUTPUT_KEYS = ["diagnosis", "prescription", "medicine", "treatmentPlan"];

  function optionText(option) {
    return typeof option === "string" ? option : option.text;
  }

  function understandInput(text, context) {
    const symptom = detectSymptom(text, context);
    const redFlag = matchedRedFlagKeyword(text, context);

    return {
      symptom,
      redFlag,
      normalizedText: text.trim(),
      confidence: symptom ? 0.72 : 0.34,
      source: "simulated_ai",
    };
  }

  async function understandInputAsync(text, context) {
    const mode = adapterMode();
    if (mode === "simulated") return understandInput(text, context);

    const fallback = understandInput(text, context);
    const proxyResult = await requestProxyUnderstanding(text, context, fallback);

    if (mode === "llm_shadow") {
      return {
        ...fallback,
        proxyStatus: proxyResult.proxyStatus === "ok" ? "shadow_ok" : proxyResult.proxyStatus,
        shadowUnderstanding: proxyResult.proxyStatus === "ok" ? proxyResult : null,
      };
    }

    return proxyResult;
  }

  async function requestProxyUnderstanding(text, context, fallback) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), proxyTimeoutMs());

    try {
      const response = await fetch(proxyEndpoint(), {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify(createLlmInputPayload(text, context)),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
      const body = await response.json();
      const normalized = normalizeModelExtraction(body.extraction || body, context);
      const validation = validateUnderstanding(normalized, context);

      if (!validation.valid) {
        return {
          ...fallback,
          source: "simulated_ai",
          proxyStatus: "invalid_llm_output",
          validationIssues: validation.issues,
        };
      }

      return {
        ...normalized,
        normalizedText: normalized.normalizedText || String(text || "").trim(),
        source: "llm",
        proxyStatus: "ok",
        requestId: body.requestId || "",
      };
    } catch (error) {
      return {
        ...fallback,
        source: "simulated_ai",
        proxyStatus: "fallback",
        proxyError: error?.name === "AbortError" ? "timeout" : "request_failed",
        requestId: "",
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function shouldUseProxy() {
    return adapterMode() === "llm" || adapterMode() === "llm_shadow";
  }

  function adapterMode() {
    const mode = grayModeOverride() || adapterConfig().mode || "simulated";
    return ["simulated", "llm_shadow", "llm"].includes(mode) ? mode : "simulated";
  }

  function adapterConfig() {
    return window.SYMPTOMMATE_AI_CONFIG || {};
  }

  function proxyEndpoint() {
    return adapterConfig().proxyEndpoint || DEFAULT_PROXY_ENDPOINT;
  }

  function requestHeaders() {
    const headers = { "Content-Type": "application/json" };
    const betaCode = betaCodeFromSession();
    if (betaCode) headers["X-Beta-Code"] = betaCode;
    return headers;
  }

  function betaCodeFromSession() {
    try {
      const key = adapterConfig().betaCodeStorageKey || DEFAULT_BETA_CODE_STORAGE_KEY;
      return window.sessionStorage?.getItem(key)?.trim() || "";
    } catch (error) {
      return "";
    }
  }

  function grayModeOverride() {
    try {
      const param = adapterConfig().grayModeQueryParam || "ai";
      const value = new URLSearchParams(window.location?.search || "").get(param);
      if (value === "shadow") return "llm_shadow";
      if (value === "llm") return "llm";
      return "";
    } catch (error) {
      return "";
    }
  }

  function proxyTimeoutMs() {
    const value = Number(adapterConfig().timeoutMs);
    return Number.isFinite(value) && value > 0 ? value : 7000;
  }

  function detectSymptom(text, context) {
    const { symptoms, relatedWords } = context.symptomConfig;
    return symptoms.find((item) => text.includes(item) || relatedWords[item]?.some((word) => text.includes(word))) || "";
  }

  function matchedRedFlagKeyword(text, context) {
    return context.symptomConfig.redFlagKeywords.find((word) => text.includes(word)) || "";
  }

  function getQuestionPurpose(question) {
    const text = question.label || "";
    if (text.includes("红线") || text.includes("神经") || text.includes("急腹") || text.includes("过敏")) {
      return "我问这个是为了先排除需要立即线下处理的危险信号。";
    }
    if (text.includes("持续") || text.includes("时间")) {
      return "我问持续时间，是为了判断是否已经超过建议就医窗口。";
    }
    if (text.includes("人群")) {
      return "儿童、老人、孕产妇和有基础病人群需要更保守地判断。";
    }
    if (text.includes("严重") || text.includes("影响") || text.includes("状态")) {
      return "我问严重程度，是为了判断是否还适合先观察。";
    }
    return "这个问题会帮助我更稳妥地判断下一步行动。";
  }

  function estimateRisk(context) {
    const { symptom, answers, confidence } = context;
    const selectedValues = Object.values(answers).join(" ");
    const rules = context.medicalRules?.rules?.[symptom];

    if (matchesAny(selectedValues, rules?.redRules || [])) return "red";
    if (isSpecialPopulation(answers)) return "yellow";
    if (isConservativeSymptom(symptom)) return "yellow";
    if (matchesAnyRuleToken(selectedValues, rules?.yellowRules || [])) return "yellow";
    if (matchesAllRuleTokens(selectedValues, rules?.greenRules || [])) return "green";
    if (confidence < 0.5) return "yellow";
    return "green";
  }

  function matchesAny(text, rules) {
    const normalizedText = normalizeRuleText(text);
    return rules.some((rule) => {
      const normalizedRule = normalizeRuleText(rule);
      return normalizedText.includes(normalizedRule) || normalizedRule.includes(normalizedText);
    });
  }

  function normalizeRuleText(text) {
    return String(text).replace(/[、/，,或和\s]/g, "");
  }

  function matchesAnyRuleToken(text, rules) {
    const normalizedText = normalizeRuleText(text);
    return rules.some((rule) => {
      const tokens = splitRuleTokens(rule).map(normalizeRuleText).filter((token) => token.length >= 2);
      return tokens.some((token) => normalizedText.includes(token));
    });
  }

  function splitRuleTokens(rule) {
    return String(rule)
      .split(/[、/，,或和；;但且\s]+/)
      .flatMap((part) => part.split(/(?=伴|未|不|超过|持续|明显|活动后|夜间|戴|可能|无法|尿频|吞咽|颜色|流脓|听力|眼痛|体重)/g));
  }

  function matchesAllRuleTokens(text, rules) {
    const normalizedText = normalizeRuleText(text);
    return rules.some((rule) => {
      const tokens = splitRuleTokens(rule).map(normalizeRuleText).filter((token) => token.length >= 2);
      return tokens.length > 0 && tokens.every((token) => normalizedText.includes(token));
    });
  }

  function isConservativeSymptom(symptom) {
    return ["胸痛", "头晕"].includes(symptom);
  }

  function getResultReason(risk, context) {
    if (risk === "yellow" && isSpecialPopulation(context.answers)) {
      return "当前信息未触发红灯，但自查对象属于需要更保守判断的人群，建议尽快线下评估。";
    }
    if (risk === "yellow") return "当前信息提示存在需要尽快线下评估的因素。";
    if (risk === "green") return "已根据当前信息完成保守评估，暂未看到必须立即急诊的信号。";
    return "当前信息包含需要立即线下处理的红线信号。";
  }

  function isSpecialPopulation(answers) {
    return ["儿童", "老人", "孕产妇", "有基础病"].includes(answers.group);
  }

  function createLlmInputPayload(text, context) {
    return {
      schemaVersion: LLM_SCHEMA_VERSION,
      task: "extract_symptom_self_check_entities",
      locale: "zh-CN",
      userInput: String(text || "").trim(),
      currentContext: {
        selectedGroup: context.answers?.group || "",
        currentSymptom: context.symptom || "",
      },
      allowedValues: {
        symptoms: context.symptomConfig?.symptoms || [],
        groups: ALLOWED_GROUPS,
        redFlagKeywords: context.symptomConfig?.redFlagKeywords || [],
      },
      outputContract: {
        symptom: "string, must be one of allowedValues.symptoms or empty string",
        redFlag: "string, must be matched from userInput or empty string",
        extracted: {
          duration: "string",
          severity: "string",
          group: "string, must be one of allowedValues.groups or empty string",
          associatedSymptoms: "string[]",
        },
        confidence: "number between 0 and 1",
      },
      safetyRules: [
        "Only extract and normalize information from the user input.",
        "Do not diagnose disease.",
        "Do not prescribe medicine.",
        "Do not decide red/yellow/green risk; the local rule layer decides risk.",
      ],
    };
  }

  function normalizeModelExtraction(extraction, context) {
    const safeExtraction = extraction && typeof extraction === "object" ? extraction : {};
    const extracted = safeExtraction.extracted && typeof safeExtraction.extracted === "object" ? safeExtraction.extracted : {};
    const normalizedText = cleanText(safeExtraction.normalizedText || safeExtraction.originalText || "");
    const symptom = pickAllowedSymptom(safeExtraction.symptom, context);
    const redFlag = pickKnownRedFlag(safeExtraction.redFlag, context) || pickKnownRedFlagFromList(safeExtraction.redFlags, context);
    const group = pickAllowedGroup(extracted.group || safeExtraction.group || context.answers?.group || "");

    return {
      symptom,
      redFlag,
      normalizedText,
      extracted: {
        duration: cleanText(extracted.duration),
        severity: cleanText(extracted.severity),
        group,
        associatedSymptoms: Array.isArray(extracted.associatedSymptoms)
          ? extracted.associatedSymptoms.map(cleanText).filter(Boolean).slice(0, 8)
          : [],
      },
      confidence: clampConfidence(safeExtraction.confidence),
      source: "llm",
      schemaVersion: LLM_SCHEMA_VERSION,
    };
  }

  function validateUnderstanding(result, context) {
    const issues = [];
    const safeResult = result && typeof result === "object" ? result : {};

    if (!safeResult.symptom && !safeResult.redFlag) {
      issues.push("模型未抽取到可用症状或红线词");
    }
    if (safeResult.symptom && !pickAllowedSymptom(safeResult.symptom, context)) {
      issues.push("模型症状不在本地配置列表中");
    }
    if (safeResult.redFlag && !pickKnownRedFlag(safeResult.redFlag, context)) {
      issues.push("模型红线词不在本地红线关键词列表中");
    }
    if (typeof safeResult.confidence !== "number" || safeResult.confidence < 0 || safeResult.confidence > 1) {
      issues.push("模型置信度不是 0 到 1 之间的数字");
    }
    if (hasForbiddenClinicalOutput(safeResult)) {
      issues.push("模型输出包含诊断、处方或治疗方案字段");
    }

    return {
      valid: issues.length === 0,
      issues,
      schemaVersion: LLM_SCHEMA_VERSION,
    };
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function pickAllowedSymptom(value, context) {
    const symptom = cleanText(value);
    const symptoms = context.symptomConfig?.symptoms || [];
    return symptoms.includes(symptom) ? symptom : "";
  }

  function pickAllowedGroup(value) {
    const group = cleanText(value);
    return ALLOWED_GROUPS.includes(group) ? group : "";
  }

  function pickKnownRedFlag(value, context) {
    const redFlag = cleanText(value);
    const redFlagKeywords = context.symptomConfig?.redFlagKeywords || [];
    return redFlagKeywords.includes(redFlag) ? redFlag : "";
  }

  function pickKnownRedFlagFromList(values, context) {
    if (!Array.isArray(values)) return "";
    return values.map((value) => pickKnownRedFlag(value, context)).find(Boolean) || "";
  }

  function clampConfidence(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 0.3;
    return Math.max(0, Math.min(1, numberValue));
  }

  function hasForbiddenClinicalOutput(value) {
    if (!value || typeof value !== "object") return false;
    return Object.keys(value).some((key) => {
      if (FORBIDDEN_OUTPUT_KEYS.includes(key)) return true;
      return hasForbiddenClinicalOutput(value[key]);
    });
  }

  window.AI_ADAPTER = {
    mode: adapterMode(),
    integrationStatus: shouldUseProxy() ? "llm_proxy_enabled" : "llm_ready_not_connected",
    understandInput,
    understandInputAsync,
    getQuestionPurpose,
    estimateRisk,
    getResultReason,
    integration: {
      schemaVersion: LLM_SCHEMA_VERSION,
      createLlmInputPayload,
      normalizeModelExtraction,
      validateUnderstanding,
    },
  };
})();
