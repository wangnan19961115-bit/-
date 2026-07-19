const {
  symptoms,
  symptomProfiles,
  commonQuestions,
  symptomQuestions,
  redFlagKeywords,
  relatedWords,
  escalationSignalsBySymptom,
} = window.SYMPTOM_CONFIG;

const aiAdapter = window.AI_ADAPTER;
const betaConfig = window.SYMPTOMMATE_AI_CONFIG || {};
const betaCodeStorageKey = betaConfig.betaCodeStorageKey || "symptomMateBetaCode";
const initialBetaCode = readBetaCode();

const state = {
  view: "home",
  activeTab: "home",
  consentVisible: false,
  consentChecked: false,
  selectedGroup: "成年人",
  selectedSymptom: "",
  messages: [],
  answers: {},
  answerMeta: {},
  questionIndex: 0,
  confidence: 34,
  result: null,
  toast: "",
  aiPending: false,
  aiStatus: null,
  aiDebug: {
    loading: false,
    checkedAt: "",
    health: null,
    config: null,
    error: "",
    lastRequestId: "",
    lastFallbackReason: "",
  },
  betaAccess: {
    code: "",
    pendingCode: initialBetaCode,
    verifying: false,
    error: "",
  },
};

const app = document.querySelector("#app");

const icon = {
  logo: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5l3 2M4 4v5h5M4.5 13a8 8 0 1 0 2.1-5.4L4 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mine: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 11 17-8-8 17-2-7-7-2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3ZM5 10v1a7 7 0 0 0 14 0v-1M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l5 5v13H7V3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5M10 13h6M10 17h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function historyItems() {
  return JSON.parse(localStorage.getItem("symptomMateHistory") || "[]");
}

function feedbackItems() {
  return JSON.parse(localStorage.getItem("symptomMateFeedback") || "[]");
}

function analyticsEvents() {
  return JSON.parse(localStorage.getItem("symptomMateEvents") || "[]");
}

function readBetaCode() {
  try {
    return sessionStorage.getItem(betaCodeStorageKey) || "";
  } catch (error) {
    return "";
  }
}

function betaAccessEnabled() {
  return Boolean(state.betaAccess.code && !state.betaAccess.verifying);
}

async function saveBetaCode(code) {
  const normalized = String(code || "").trim();
  if (!normalized) {
    state.betaAccess.error = "请输入试用口令";
    state.betaAccess.code = "";
    state.betaAccess.pendingCode = "";
    render();
    return;
  }

  state.betaAccess.error = "";
  state.betaAccess.verifying = true;
  state.betaAccess.pendingCode = normalized;
  render();

  const verified = await verifyBetaCode(normalized);
  state.betaAccess.verifying = false;
  if (!verified.ok) {
    clearStoredBetaCode();
    state.betaAccess.code = "";
    state.betaAccess.pendingCode = "";
    state.betaAccess.error = betaVerificationMessage(verified.reason);
    render();
    return;
  }

  try {
    sessionStorage.setItem(betaCodeStorageKey, normalized);
  } catch (error) {
    state.betaAccess.error = "当前浏览器无法保存本次试用口令";
    render();
    return;
  }
  state.betaAccess.code = normalized;
  state.betaAccess.pendingCode = "";
  state.betaAccess.error = "";
  render();
}

function clearBetaCode() {
  clearStoredBetaCode();
  state.betaAccess.code = "";
  state.betaAccess.pendingCode = "";
  showToast("试用口令已清除");
  render();
}

function clearStoredBetaCode() {
  try {
    sessionStorage.removeItem(betaCodeStorageKey);
  } catch (error) {}
}

function recordAnalyticsEvent(type, payload = {}) {
  const events = analyticsEvents();
  events.unshift({
    type,
    ...payload,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("symptomMateEvents", JSON.stringify(events.slice(0, 200)));
}

function saveHistory(item) {
  const list = historyItems();
  list.unshift(item);
  localStorage.setItem("symptomMateHistory", JSON.stringify(list.slice(0, 30)));
  recordAnalyticsEvent("session_complete", {
    symptom: item.symptom,
    risk: item.risk,
    confidence: item.confidence,
    resultId: item.id,
  });
}

function clearHistory() {
  localStorage.removeItem("symptomMateHistory");
  showToast("历史记录已清空");
  render();
}

function setView(view, tab = state.activeTab) {
  state.view = view;
  state.activeTab = tab;
  render();
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function showToast(text) {
  state.toast = text;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
}

function shell(content, options = {}) {
  const title = options.title || "SymptomMate";
  const subtitle = options.subtitle || "症状自查助手";
  const back = options.back;
  const hideTabs = options.hideTabs;
  const extraClass = options.extraClass || "";

  return `
    <main class="shell ${extraClass}">
      <header class="topbar">
        <div class="brand">
          ${
            back
              ? `<button class="icon-btn" onclick="${back}" aria-label="返回">${icon.arrow}</button>`
              : `<div class="brand-mark">${icon.logo}</div>`
          }
          <div>
            <div class="brand-title">${title}</div>
            <div class="brand-subtitle">${subtitle}</div>
          </div>
        </div>
        <div class="avatar" title="跳过登录模式">${icon.user}</div>
      </header>
      ${content}
      ${hideTabs ? "" : tabbar()}
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </main>
    ${state.consentVisible ? consentModal() : ""}
  `;
}

function betaGateView() {
  const betaValue = state.betaAccess.pendingCode || "";
  return `
    <main class="shell">
      <section class="content beta-gate">
        <div class="section panel hero-panel">
          <div class="eyebrow">SymptomMate 小范围试用</div>
          <h1>输入试用口令后开始自查</h1>
          <p class="body-copy">本工具只做健康信息参考和就医准备建议，不提供诊断、治疗或处方。试用口令仅保存在当前浏览器会话中。</p>
          <form class="beta-form" onsubmit="submitBetaAccess(event)">
            <label class="field-label" for="betaCodeInput">试用口令</label>
            <input id="betaCodeInput" class="text-input" type="password" autocomplete="off" placeholder="请输入口令" value="${escapeAttr(betaValue)}" ${state.betaAccess.verifying ? "disabled" : ""} />
            ${state.betaAccess.error ? `<div class="notice risk-red">${state.betaAccess.error}</div>` : ""}
            <button class="primary-btn" type="submit" ${state.betaAccess.verifying ? "disabled" : ""}>${state.betaAccess.verifying ? "正在验证..." : "进入试用"}</button>
          </form>
        </div>
        <div class="notice warning">如出现胸痛伴呼吸困难、意识不清、抽搐、便血/呕血、突发剧烈头痛等危险信号，请优先拨打 120 或前往急诊。</div>
        <div class="legal-links">
          <a href="./privacy.html" target="_blank" rel="noopener">隐私政策</a>
          <a href="./terms.html" target="_blank" rel="noopener">使用条款与医疗免责声明</a>
        </div>
      </section>
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </main>
  `;
}

function submitBetaAccess(event) {
  event.preventDefault();
  if (state.betaAccess.verifying) return;
  const input = document.querySelector("#betaCodeInput");
  saveBetaCode(input?.value || "");
}

function tabbar() {
  return `
    <nav class="tabbar" aria-label="底部导航">
      <button class="tab ${state.activeTab === "home" ? "active" : ""}" onclick="setView('home','home')">${icon.home}<span>自查</span></button>
      <button class="tab ${state.activeTab === "history" ? "active" : ""}" onclick="setView('history','history')">${icon.history}<span>历史</span></button>
      <button class="tab ${state.activeTab === "mine" ? "active" : ""}" onclick="setView('mine','mine')">${icon.mine}<span>我的</span></button>
    </nav>
  `;
}

function consentModal() {
  return `
    <div class="modal-mask">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <h2 id="consent-title">开始前请确认</h2>
        <p class="body-copy">本工具仅提供健康信息参考和就医准备建议，不能替代医生面诊、检查和专业判断。若出现明显危急症状，请立即拨打 120 或前往急诊。</p>
        <label class="check-row">
          <input type="checkbox" ${state.consentChecked ? "checked" : ""} onchange="state.consentChecked=this.checked; render();" />
          <span>我已知晓：本工具不提供诊断、治疗或处方建议。</span>
        </label>
        <label class="field-label" for="groupSelect">本次自查对象</label>
        <select id="groupSelect" class="text-input" onchange="state.selectedGroup=this.value">
          ${["成年人", "儿童", "老人", "孕产妇", "有基础病"]
            .map((group) => `<option value="${group}" ${state.selectedGroup === group ? "selected" : ""}>${group}</option>`)
            .join("")}
        </select>
        <button class="primary-btn" onclick="confirmConsent()">确认并开始</button>
        <button class="ghost-btn" style="width:100%; margin-top:8px;" onclick="state.consentVisible=false; render();">暂不开始</button>
      </section>
    </div>
  `;
}

function homeView() {
  return shell(`
    <section class="content">
      <div class="section panel hero-panel">
        <div class="eyebrow">就医前 5 分钟自查</div>
        <h1>身体不舒服？先把情况说清楚。</h1>
        <p class="body-copy">我会按症状、持续时间、严重程度和红线信号做保守评估，帮你整理下一步就医参考。</p>
        <div style="height:16px"></div>
        <button class="primary-btn" onclick="openConsent()">开始自查</button>
      </div>

      <div class="section panel">
        <h2>常见症状</h2>
        <div class="quick-grid">
          ${symptoms.map((item) => `<button class="symptom-chip" onclick="openConsent('${item}')">${item}</button>`).join("")}
        </div>
      </div>

      <div class="section notice warning">
        出现胸痛伴呼吸困难、意识不清、抽搐、便血/呕血、突发剧烈头痛、肢体无力或儿童/老人持续高热等情况时，请优先线下急诊处理。
      </div>
    </section>
  `);
}

function openConsent(symptom = "") {
  state.selectedSymptom = symptom;
  state.consentChecked = false;
  state.selectedGroup = "成年人";
  state.consentVisible = true;
  render();
}

function confirmConsent() {
  if (!state.consentChecked) {
    showToast("请先勾选知情确认");
    return;
  }
  startChat(state.selectedSymptom);
}

function startChat(symptom = "") {
  state.consentVisible = false;
  state.view = "chat";
  state.activeTab = "home";
  state.selectedSymptom = symptom;
  state.messages = [
    {
      from: "ai",
      text: symptom
        ? `已选择“${symptom}”。我会先问几个关键问题，最多 5 轮，过程里如果发现红线信号会立即提示就医。`
        : "请先用一句话描述你的主要不舒服，比如“发热两天，最高39度”或“胸口闷痛半小时”。",
    },
  ];
  state.answers = { group: state.selectedGroup || "成年人" };
  state.answerMeta = {
    group: {
      label: "人群",
      red: false,
    },
  };
  state.questionIndex = 0;
  state.confidence = symptom ? 46 : 28;
  if (symptom) {
    window.setTimeout(() => askNextQuestion(), 180);
  }
  render();
}

function chatView() {
  const currentQuestion = activeQuestions()[state.questionIndex];
  const aiSubtitle =
    aiAdapter.mode === "llm" ? "真实 AI 辅助理解" : aiAdapter.mode === "llm_shadow" ? "真实 AI 灰度观察" : "模拟 AI 对话";
  const aiStatus = aiStatusMeta();
  return shell(`
    <section class="content" style="padding-bottom:138px;">
      <div class="notice">请一次性完成本次自查，中途退出后建议重新开始，以免遗漏关键信息。</div>
      ${
        aiStatus
          ? `<div class="notice ${aiStatus.className}" style="margin-top:10px;">${aiStatus.text}</div>`
          : ""
      }
      <div style="height:12px"></div>
      <div class="chat-area">
        ${state.messages.map(messageHtml).join("")}
        ${
          currentQuestion && state.messages.at(-1)?.questionId === currentQuestion.id
            ? `<div class="options-row">${currentQuestion.options
                .map((option, index) => `<button class="option-chip" onclick="answerQuestion(${index})">${optionText(option)}</button>`)
                .join("")}</div>`
            : ""
        }
      </div>
    </section>
    <div class="chat-input-wrap">
      <div class="confidence-strip">
        <div class="confidence-row"><span>当前信息完整度</span><strong>${state.confidence}%</strong></div>
        <div class="meter"><div class="meter-fill" style="width:${state.confidence}%; background:${confidenceColor(state.confidence)}"></div></div>
      </div>
      <form class="chat-form" onsubmit="submitFreeText(event)">
        <input id="chatInput" class="text-input" autocomplete="off" placeholder="${state.aiPending ? "正在理解..." : "补充症状或回答问题"}" ${state.aiPending ? "disabled" : ""} />
        <button class="icon-btn" type="button" onclick="showToast('语音输入将在后续版本开放')" aria-label="语音输入" ${state.aiPending ? "disabled" : ""}>${icon.mic}</button>
        <button class="icon-btn" type="submit" aria-label="发送" ${state.aiPending ? "disabled" : ""}>${icon.send}</button>
      </form>
    </div>
  `, { title: "症状自查", subtitle: aiSubtitle, back: "setView('home','home')", hideTabs: true });
}

function aiStatusMeta() {
  if (state.aiPending) {
    return { className: "", text: "正在使用真实 AI 理解你的描述..." };
  }
  if (!state.aiStatus) return null;
  const copy = {
    ok: { className: "risk-green", text: "真实 AI 已完成理解，风险判断仍由本地医学规则完成。" },
    shadow_ok: { className: "", text: "真实 AI 已完成灰度观察，本次路径仍使用本地规则。" },
    fallback: { className: "warning", text: "AI 理解暂不可用，已使用本地规则继续自查。" },
    invalid_llm_output: { className: "warning", text: "AI 输出未通过安全校验，已使用本地规则继续自查。" },
  };
  return copy[state.aiStatus] || null;
}

function activeQuestions() {
  return symptomQuestions[state.selectedSymptom] || commonQuestions;
}

function optionText(option) {
  return typeof option === "string" ? option : option.text;
}

function messageHtml(message) {
  return `
    <div class="message ${message.from}">
      ${message.from === "ai" ? `<div class="icon-box">${icon.logo}</div>` : ""}
      <div class="bubble">${message.text}</div>
    </div>
  `;
}

function questionPurpose(question) {
  return aiAdapter.getQuestionPurpose(question);
}

async function submitFreeText(event) {
  event.preventDefault();
  if (state.aiPending) return;
  const input = document.querySelector("#chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  state.messages.push({ from: "user", text });
  state.aiPending = true;
  render();

  const inputUnderstanding = await understandFreeText(text);
  state.aiPending = false;
  state.aiStatus = inputUnderstanding.proxyStatus || (inputUnderstanding.source === "llm" ? "ok" : null);
  state.aiDebug.lastRequestId = inputUnderstanding.requestId || state.aiDebug.lastRequestId || "";
  if (inputUnderstanding.proxyStatus === "shadow_ok") {
    recordAnalyticsEvent("ai_shadow_understanding", {
      localSymptom: inputUnderstanding.symptom,
      llmSymptom: inputUnderstanding.shadowUnderstanding?.symptom || "",
      localRedFlag: inputUnderstanding.redFlag,
      llmRedFlag: inputUnderstanding.shadowUnderstanding?.redFlag || "",
    });
  }
  if (inputUnderstanding.proxyStatus === "fallback" || inputUnderstanding.proxyStatus === "invalid_llm_output") {
    state.aiDebug.lastFallbackReason = inputUnderstanding.proxyError || inputUnderstanding.proxyStatus;
    recordAnalyticsEvent("ai_proxy_fallback", {
      reason: inputUnderstanding.proxyError || inputUnderstanding.proxyStatus,
    });
    showToast(state.aiStatus === "invalid_llm_output" ? "AI 输出未通过校验，已回退本地规则" : "AI 暂不可用，已回退本地规则");
  }
  const detected = inputUnderstanding.symptom;
  if (!state.selectedSymptom && detected) {
    state.selectedSymptom = detected;
    state.messages.push({ from: "ai", text: `我先按“${detected}”来收集信息。如果还有其他不适，也可以继续补充。` });
  }

  const matchedRedFlag = inputUnderstanding.redFlag;
  if (matchedRedFlag) {
    state.result = buildResult("red", `因为你提到了“${matchedRedFlag}”，这是需要立即线下处理的红线信号。`, {
      trigger: matchedRedFlag,
      triggerSource: "free_text",
    });
    saveHistoryFromResult();
    setView("alert", "home");
    return;
  }

  if (!state.selectedSymptom) {
    state.messages.push({ from: "ai", text: "我还没识别到明确的主要症状。可以从胸痛、头痛、腹痛、咳嗽、发热、腹泻、头晕、背痛、皮疹、呕吐中选一个最主要的。", questionId: "pick" });
    render();
    return;
  }

  if (state.questionIndex === 0) {
    askNextQuestion();
  } else {
    state.answers[`free_${Date.now()}`] = text;
    state.confidence = Math.min(88, state.confidence + 8);
    askNextQuestion();
  }
}

async function understandFreeText(text) {
  if (typeof aiAdapter.understandInputAsync === "function") {
    return aiAdapter.understandInputAsync(text, aiContext());
  }
  return aiAdapter.understandInput(text, aiContext());
}

function askNextQuestion() {
  const questions = activeQuestions();
  if (state.questionIndex >= questions.length) {
    finishAssessment();
    return;
  }
  const question = questions[state.questionIndex];
  state.messages.push({ from: "ai", text: `${question.text}\n${questionPurpose(question)}`, questionId: question.id });
  render();
}

function answerQuestion(optionIndex) {
  const questions = activeQuestions();
  const question = questions[state.questionIndex];
  const selectedOption = question.options[optionIndex];
  const option = optionText(selectedOption);
  state.messages.push({ from: "user", text: option });
  state.answers[question.id] = option;
  state.answerMeta = {
    ...(state.answerMeta || {}),
    [question.id]: {
      label: question.label || question.text,
      red: Boolean(selectedOption?.red),
    },
  };
  state.questionIndex += 1;
  state.confidence = Math.min(92, state.confidence + 12);

  if (selectedOption?.red) {
    state.result = buildResult("red", `因为你选择了“${option}”，属于需要优先排查的红线情况。`, {
      trigger: option,
      triggerSource: question.label || question.text,
    });
    saveHistoryFromResult();
    setView("alert", "home");
    return;
  }

  if (state.questionIndex >= questions.length) {
    finishAssessment();
  } else {
    window.setTimeout(() => askNextQuestion(), 160);
    render();
  }
}

function finishAssessment() {
  const risk = estimateRisk();
  state.result = buildResult(risk, resultReasonForRisk(risk));
  saveHistoryFromResult();
  setView("result", "home");
}

function resultReasonForRisk(risk) {
  return aiAdapter.getResultReason(risk, aiContext());
}

function estimateRisk() {
  return aiAdapter.estimateRisk(aiContext());
}

function isSpecialPopulation() {
  return ["儿童", "老人", "孕产妇", "有基础病"].includes(state.answers.group);
}

function buildResult(risk, reason, meta = {}) {
  const profile = symptomProfiles[state.selectedSymptom] || symptomProfiles.发热;
  const confidence = adjustedConfidence(risk);
  const riskCopy = {
    red: ["红灯", "建议立即线下就医或急诊评估", 96],
    yellow: ["黄灯", "建议尽快预约就医，不建议长期自行观察", confidence],
    green: ["绿灯", "可先观察和护理，但需留意红线变化", confidence],
  };
  return {
    id: Date.now(),
    symptom: state.selectedSymptom || "未明确症状",
    risk,
    riskName: riskCopy[risk][0],
    action: riskCopy[risk][1],
    confidence: riskCopy[risk][2],
    reason,
    trigger: meta.trigger || "",
    triggerSource: meta.triggerSource || "",
    lowConfidence: confidence < 70,
    department: profile.department,
    backup: profile.backup,
    checks: profile.checks,
    care: profile.care,
    questions: profile.questions,
    related: profile.related,
    answers: { ...state.answers },
    answerMeta: { ...(state.answerMeta || {}) },
    date: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function saveHistoryFromResult() {
  if (!state.result) return;
  if (state.result.saved) return;
  state.result.saved = true;
  saveHistory(state.result);
}

function detectSymptom(text) {
  return aiAdapter.understandInput(text, aiContext()).symptom;
}

function matchedRedFlagKeyword(text) {
  return aiAdapter.understandInput(text, aiContext()).redFlag;
}

function aiContext() {
  return {
    symptom: state.selectedSymptom,
    answers: state.answers || {},
    confidence: state.confidence / 100,
    symptomConfig: window.SYMPTOM_CONFIG,
    medicalRules: window.MEDICAL_RULES,
  };
}

function adjustedConfidence(risk) {
  if (risk === "red") return 96;
  const answeredCount = Object.keys(state.answers || {}).filter((key) => !key.startsWith("free_")).length;
  const base = Math.max(42, state.confidence);
  const adjusted = answeredCount < 3 ? Math.min(base, 62) : base;
  return risk === "yellow" ? Math.max(58, adjusted) : Math.max(60, adjusted);
}

function resultView() {
  const result = state.result || historyItems()[0];
  if (!result) return homeView();

  const riskClass = result.risk === "red" ? "risk-red" : result.risk === "yellow" ? "risk-yellow" : "risk-green";
  const decision = resultDecisionCopy(result);
  const evidence = resultEvidence(result);
  const escalation = escalationSignals(result);
  const primaryActions = nextActionItems(result);
  const safetyNotes = safetyNotesForResult(result);

  return shell(`
    <section class="content">
      <div class="section decision-card ${riskClass}">
        <div class="decision-top">
          <div class="risk-badge ${riskClass}">${result.risk === "green" ? icon.check : icon.alert}</div>
          <span class="tag">${result.riskName}</span>
        </div>
        <h1>${decision.title}</h1>
        <p class="decision-lead">${decision.lead}</p>
        <div class="decision-window">${decision.window}</div>
        <div class="confidence-strip result-confidence">
          <div class="confidence-row"><span>信息完整度 / 置信度</span><strong>${result.confidence}%</strong></div>
          <div class="meter"><div class="meter-fill" style="width:${result.confidence}%; background:${confidenceColor(result.confidence)}"></div></div>
        </div>
      </div>

      <div class="section panel">
        <h2>为什么这样建议</h2>
        <ul class="reason-list">
          ${evidence.map((item) => `<li><span>${item.label}</span><strong>${item.value}</strong></li>`).join("")}
        </ul>
        <p class="body-copy" style="margin-top:12px;">${result.reason}</p>
      </div>

      ${
        safetyNotes.length
          ? `<div class="section safety-panel">
              <h2>安全说明</h2>
              <ul class="list">${safetyNotes.map((item) => `<li>${item}</li>`).join("")}</ul>
            </div>`
          : ""
      }

      <div class="section panel">
        <h2>去哪一科</h2>
        <div class="department-card">
          <div>
            <div class="muted" style="font-size:12px;">优先建议</div>
            <strong>${result.department}</strong>
          </div>
          <div>
            <div class="muted" style="font-size:12px;">备选方向</div>
            <strong>${result.backup}</strong>
          </div>
        </div>
      </div>

      <div class="section panel">
        <h2>接下来怎么做</h2>
        <ul class="list">${primaryActions.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>

      <div class="section panel">
        <h2>需要排查的方向</h2>
        <ul class="list">${result.related.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>

      <div class="section panel">
        <h2>出现这些情况请升级处理</h2>
        <ul class="list alert-list">${escalation.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>

      <div class="section feedback-panel">
        <button class="feedback-btn" onclick="recordFeedback('understood')">我看懂了</button>
        <button class="feedback-btn" onclick="recordFeedback('uncertain')">仍然不确定</button>
        <button class="feedback-btn" onclick="recordFeedback('mismatch')">建议不符合</button>
      </div>

      <div class="section action-grid">
        <button class="secondary-btn" onclick="setView('referral','home')">${icon.file}转诊单</button>
        <button class="secondary-btn" onclick="setView('prep','home')">准备清单</button>
        <button class="secondary-btn" onclick="setView('questions','home')">问题清单</button>
        <button class="secondary-btn" onclick="openConsent()">重新自查</button>
      </div>

      <div class="notice">本结果不构成诊断、治疗或处方。若症状加重、出现红线信号，或你仍感到不放心，请优先线下就医。</div>
    </section>
  `, { title: "自查结果", subtitle: "下一步行动", back: "setView('home','home')" });
}

function safetyNotesForResult(result) {
  const notes = [];
  if (result.trigger) {
    notes.push(`触发原因：${result.triggerSource ? `${result.triggerSource} - ` : ""}${result.trigger}。因此系统按红线处理，不提供继续自查入口。`);
  }
  if (result.lowConfidence) {
    notes.push("当前信息完整度偏低，结果会自动偏保守；如果你仍不确定，建议线下就医评估。");
  }
  if (["儿童", "老人", "孕产妇", "有基础病"].includes(result.answers?.group)) {
    notes.push(`${result.answers.group}属于更需要谨慎判断的人群，系统会优先给出更保守的就医建议。`);
  }
  notes.push("本工具只提供健康信息参考，不替代医生面诊、检查和专业判断。");
  return notes;
}

function recordFeedback(type) {
  const labels = {
    understood: "我看懂了",
    uncertain: "仍然不确定",
    mismatch: "建议不符合情况",
  };
  const events = JSON.parse(localStorage.getItem("symptomMateFeedback") || "[]");
  events.unshift({
    type,
    label: labels[type],
    symptom: state.result?.symptom || "",
    risk: state.result?.risk || "",
    resultId: state.result?.id || "",
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("symptomMateFeedback", JSON.stringify(events.slice(0, 100)));
  recordAnalyticsEvent("feedback", {
    feedbackType: type,
    symptom: state.result?.symptom || "",
    risk: state.result?.risk || "",
    resultId: state.result?.id || "",
  });
  showToast(`已记录：${labels[type]}`);
}

function resultDecisionCopy(result) {
  const copy = {
    red: {
      title: "请优先线下急诊处理",
      lead: "当前信息包含需要立即排查的红线信号，建议不要继续自行观察。",
      window: "建议现在：拨打 120 或前往附近急诊",
    },
    yellow: {
      title: "建议尽快就医评估",
      lead: "目前不一定代表严重问题，但已经不适合长期自行观察，建议让医生进一步判断。",
      window: "建议时间：今日或 24 小时内预约就医",
    },
    green: {
      title: "可先观察和基础护理",
      lead: "目前没有看到必须立即急诊的信号，可以先观察，但要留意症状变化。",
      window: "建议时间：先观察 24-48 小时，变化时及时就医",
    },
  };
  return copy[result.risk] || copy.yellow;
}

function resultEvidence(result) {
  const answers = result.answers || {};
  const answerMeta = result.answerMeta || {};
  const items = [{ label: "主要症状", value: result.symptom }];
  const answerItems = Object.entries(answers)
    .filter(([key]) => !key.startsWith("free_"))
    .map(([key, value]) => ({
      label: answerMeta[key]?.label || labelForAnswer(key),
      value,
    }));

  items.push(...answerItems);
  if (!answerItems.some((item) => item.label.includes("红线"))) {
    items.push({ label: "红线情况", value: result.risk === "red" ? "已触发红线" : "未见明显红线" });
  }
  return items.slice(0, 7);
}

function nextActionItems(result) {
  if (result.risk === "red") {
    return [
      "不要继续等待线上建议，请优先急诊或 120。",
      "尽量让家人或身边人陪同，避免独自前往。",
      "带上身份证、医保凭证、近期检查和用药记录。",
    ];
  }

  if (result.risk === "yellow") {
    return [
      `优先预约 ${result.department}，如症状加重可直接急诊。`,
      "就医前记录症状开始时间、变化过程和最严重程度。",
      "避免自行叠加用药，尤其不要用药物掩盖明显加重的症状。",
    ];
  }

  return [
    "先按建议做基础观察和护理，记录症状变化。",
    "如果 24-48 小时仍无缓解，建议预约相关科室评估。",
    "出现下方任一升级信号时，不要继续自行观察。",
  ];
}

function escalationSignals(result) {
  return escalationSignalsBySymptom[result.symptom] || ["症状快速加重", "出现呼吸困难、意识异常或明显虚弱", "你对当前状态仍然感到不放心"];
}

function alertView() {
  const result = state.result;
  return shell(`
    <section class="content alert-screen">
      <div class="alert-symbol">${icon.alert}</div>
      <div>
        <h1>需要立即就医</h1>
        <p class="body-copy">${result?.reason || "当前信息包含红线信号。"} 建议立即拨打 120 或前往附近急诊，由医生进行现场评估。</p>
      </div>
      <button class="danger-btn" onclick="showToast('原型中不直接拨号，请使用手机拨打 120')">拨打 120</button>
      <button class="secondary-btn" onclick="setView('home','home')">返回首页</button>
      <div class="notice risk-red">红线预警页不提供继续自查入口，避免延误线下处理。</div>
    </section>
  `, { title: "红线预警", subtitle: "优先线下处理", hideTabs: true });
}

function prepView() {
  const result = state.result || historyItems()[0];
  const common = ["身份证、医保卡或电子医保凭证", "近期检查报告、用药记录和过敏史", "记录症状开始时间、变化过程和最严重时刻", "如儿童或老人就诊，带好监护人联系方式"];
  return shell(`
    <section class="content">
      <div class="section panel">
        <h2>${result.symptom} · 就医准备清单</h2>
        <p class="body-copy">推荐科室：${result.department}。以下为固定模板，后续版本可按个人情况生成。</p>
      </div>
      <div class="section panel">
        <h2>通用准备</h2>
        <ul class="list">${common.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="section panel">
        <h2>可能需要的检查</h2>
        <ul class="list">${result.checks.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="section notice warning">如症状突然加重，请不要等待预约，优先急诊或 120。</div>
    </section>
  `, { title: "准备清单", subtitle: "固定模板", back: "setView('result','home')" });
}

function questionsView() {
  const result = state.result || historyItems()[0];
  return shell(`
    <section class="content">
      <div class="section panel">
        <h2>你可以问医生</h2>
        <p class="body-copy">以下是 MVP 静态示例，用来帮助你在面诊时把关键信息问清楚。</p>
      </div>
      <div class="section panel">
        <ul class="list">${result.questions.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="section panel">
        <h2>通用补充问题</h2>
        <ul class="list">
          <li>我需要观察哪些变化？多久复查？</li>
          <li>如果症状没有缓解，下一步应该怎么处理？</li>
          <li>日常生活中有哪些需要暂时避免的行为？</li>
        </ul>
      </div>
    </section>
  `, { title: "问题清单", subtitle: "面诊沟通辅助", back: "setView('result','home')" });
}

function referralView() {
  const result = state.result || historyItems()[0];
  return shell(`
    <section class="content">
      <div class="section panel">
        <h2>就医参考单</h2>
        <div class="info-grid">
          <div class="kv"><span>姓名</span><span>未填写</span></div>
          <div class="kv"><span>年龄/性别</span><span>未填写</span></div>
          <div class="kv"><span>主诉</span><span>${result.symptom}</span></div>
          <div class="kv"><span>风险等级</span><span>${result.riskName}</span></div>
          <div class="kv"><span>建议科室</span><span>${result.department}</span></div>
          <div class="kv"><span>生成时间</span><span>${result.date}</span></div>
        </div>
      </div>
      <div class="section panel">
        <h2>已收集信息</h2>
        <ul class="list">${Object.entries(result.answers)
          .map(([key, value]) => `<li>${labelForAnswer(key)}：${value}</li>`)
          .join("")}</ul>
      </div>
      <div class="section panel">
        <h2>医生沟通提示</h2>
        <p class="body-copy">你可以问医生：${result.questions.join("；")} 正式版将生成个性化问题清单。</p>
      </div>
      <button class="primary-btn" onclick="saveHistoryFromResult(); showToast('已保存到本地历史记录')">保存到历史记录</button>
    </section>
  `, { title: "转诊单", subtitle: "MVP 结构化示例", back: "setView('result','home')" });
}

function historyView() {
  const list = historyItems();
  return shell(`
    <section class="content">
      ${
        list.length
          ? `<div class="section" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
              <h2 style="margin:0;">自查记录</h2>
              <button class="ghost-btn" onclick="clearHistory()">清空</button>
            </div>
            <div class="section info-grid">
              ${list
                .map(
                  (item) => `
                  <article class="history-item">
                    <div class="history-top">
                      <div>
                        <h3>${item.symptom}</h3>
                        <p class="muted" style="font-size:12px;">${item.date}</p>
                      </div>
                      <span class="tag">${item.riskName}</span>
                    </div>
                    <div class="kv"><span>建议科室</span><span>${item.department}</span></div>
                    <button class="secondary-btn" onclick="openHistory(${item.id})">查看结果</button>
                  </article>
                `,
                )
                .join("")}
            </div>`
          : `<div class="empty panel">
              <div>
                <div class="empty-visual"></div>
                <h2>暂无自查记录</h2>
                <p class="body-copy">去首页开始第一次自查吧。跳过登录模式下，记录会保存在本机浏览器。</p>
                <div style="height:14px"></div>
                <button class="primary-btn" onclick="setView('home','home')">开始自查</button>
              </div>
            </div>`
      }
    </section>
  `, { title: "历史记录", subtitle: "本地存储", });
}

function openHistory(id) {
  const item = historyItems().find((entry) => entry.id === id);
  if (!item) return;
  state.result = item;
  setView("result", "history");
}

function analyticsSummary() {
  const history = historyItems();
  const feedback = feedbackItems();
  const events = analyticsEvents();
  const riskCounts = countBy(history, "risk");
  const symptomCounts = countBy(history, "symptom");
  const feedbackCounts = countBy(feedback, "type");
  const completed = history.length;
  const red = riskCounts.red || 0;
  const yellow = riskCounts.yellow || 0;
  const green = riskCounts.green || 0;
  const understood = feedbackCounts.understood || 0;
  const uncertain = feedbackCounts.uncertain || 0;
  const mismatch = feedbackCounts.mismatch || 0;
  const negativeFeedback = uncertain + mismatch;
  const feedbackTotal = feedback.length;

  return {
    history,
    feedback,
    events,
    completed,
    riskCounts: { red, yellow, green },
    symptomCounts,
    feedbackCounts: { understood, uncertain, mismatch },
    redRate: percent(red, completed),
    yellowRate: percent(yellow, completed),
    greenRate: percent(green, completed),
    negativeFeedbackRate: percent(negativeFeedback, feedbackTotal),
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "未知";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function topEntries(counts, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function riskNameForKey(key) {
  return { red: "红灯", yellow: "黄灯", green: "绿灯" }[key] || key;
}

function analyticsView() {
  const summary = analyticsSummary();
  const topSymptoms = topEntries(summary.symptomCounts, 6);
  const maxSymptomCount = Math.max(1, ...topSymptoms.map(([, count]) => count));
  const latestEvents = summary.events.slice(0, 6);

  return shell(`
    <section class="content">
      <div class="section panel hero-panel">
        <div class="eyebrow">本地模拟埋点</div>
        <h1>数据看板</h1>
        <p class="body-copy">当前数据来自本机浏览器的历史记录、反馈和事件日志，用于 MVP 验证，不代表真实线上数据。</p>
      </div>

      <div class="section metric-grid">
        <div class="metric-card"><span>完成自查</span><strong>${summary.completed}</strong></div>
        <div class="metric-card"><span>红线触发</span><strong>${summary.riskCounts.red}</strong></div>
        <div class="metric-card"><span>反馈数</span><strong>${summary.feedback.length}</strong></div>
        <div class="metric-card"><span>负向反馈率</span><strong>${summary.negativeFeedbackRate}%</strong></div>
      </div>

      <div class="section panel">
        <h2>红黄绿分布</h2>
        ${riskDistributionRow("red", summary.riskCounts.red, summary.completed)}
        ${riskDistributionRow("yellow", summary.riskCounts.yellow, summary.completed)}
        ${riskDistributionRow("green", summary.riskCounts.green, summary.completed)}
      </div>

      <div class="section panel">
        <h2>高频症状</h2>
        ${
          topSymptoms.length
            ? topSymptoms.map(([symptom, count]) => barRow(symptom, count, maxSymptomCount)).join("")
            : `<div class="empty-mini">暂无症状数据</div>`
        }
      </div>

      <div class="section panel">
        <h2>用户反馈</h2>
        <div class="feedback-stats">
          <div><span>我看懂了</span><strong>${summary.feedbackCounts.understood}</strong></div>
          <div><span>仍不确定</span><strong>${summary.feedbackCounts.uncertain}</strong></div>
          <div><span>建议不符合</span><strong>${summary.feedbackCounts.mismatch}</strong></div>
        </div>
      </div>

      <div class="section panel">
        <h2>最近事件</h2>
        ${
          latestEvents.length
            ? `<ul class="event-list">${latestEvents.map(eventRow).join("")}</ul>`
            : `<div class="empty-mini">暂无事件记录</div>`
        }
      </div>

      <div class="section action-grid">
        <button class="secondary-btn" onclick="setView('history','history')">查看历史</button>
        <button class="secondary-btn" onclick="clearAnalyticsData()">清空看板</button>
      </div>
    </section>
  `, { title: "数据看板", subtitle: "本地模拟", back: "setView('mine','mine')" });
}

function riskDistributionRow(key, value, total) {
  const rate = percent(value, total);
  return `
    <div class="dist-row">
      <div><span class="tag ${key}">${riskNameForKey(key)}</span><strong>${value}</strong></div>
      <div class="meter"><div class="meter-fill" style="width:${rate}%; background:${riskColor(key)}"></div></div>
      <span>${rate}%</span>
    </div>
  `;
}

function riskColor(key) {
  return { red: "var(--red)", yellow: "var(--amber)", green: "var(--green)" }[key] || "var(--primary)";
}

function barRow(label, value, max) {
  const rate = Math.max(8, Math.round((value / max) * 100));
  return `
    <div class="bar-row">
      <div><span>${label}</span><strong>${value}</strong></div>
      <div class="bar-track"><div style="width:${rate}%"></div></div>
    </div>
  `;
}

function eventRow(event) {
  const label = event.type === "session_complete" ? "完成自查" : event.type === "feedback" ? "用户反馈" : event.type;
  const detail = event.type === "feedback" ? event.feedbackType : `${event.symptom || ""} ${event.risk || ""}`;
  return `<li><span>${label}</span><strong>${detail || "-"}</strong></li>`;
}

function clearAnalyticsData() {
  localStorage.removeItem("symptomMateEvents");
  localStorage.removeItem("symptomMateFeedback");
  showToast("看板数据已清空");
  render();
}

function mineView() {
  const debug = aiDebugSummary();
  return shell(`
    <section class="content">
      <div class="section panel">
        <div class="profile-row">
          <div class="avatar">${icon.user}</div>
          <div>
            <h2 style="margin:0;">访客用户</h2>
            <p class="muted" style="font-size:13px;">跳过登录模式 · 历史记录保存在本机</p>
          </div>
        </div>
      </div>
      <div class="section menu-list">
        <button class="menu-item" onclick="setView('history','history')"><span>我的自查记录</span>${icon.arrow}</button>
        <button class="menu-item" onclick="setView('analytics','mine')"><span>数据看板</span><span class="tag">本地</span></button>
        <button class="menu-item" onclick="checkAiDebug()"><span>AI 接入状态</span><span class="tag">${debug.status}</span></button>
        <button class="menu-item" onclick="showToast('即将支持为家人自查')"><span>家庭成员</span><span class="tag">即将上线</span></button>
        <button class="menu-item" onclick="showToast('设置能力将在云端版接入')"><span>设置</span>${icon.arrow}</button>
        <a class="menu-item" href="./privacy.html" target="_blank" rel="noopener"><span>隐私政策</span>${icon.arrow}</a>
        <a class="menu-item" href="./terms.html" target="_blank" rel="noopener"><span>使用条款与医疗免责声明</span>${icon.arrow}</a>
        <button class="menu-item" onclick="showToast('SymptomMate MVP 原型 v1.0')"><span>关于我们</span>${icon.arrow}</button>
      </div>
      <div class="section panel">
        <h2>AI 调试</h2>
        <div class="info-grid">
          <div class="kv"><span>试用口令</span><span>${betaAccessEnabled() ? "已输入" : "未输入"}</span></div>
          <div class="kv"><span>模式</span><span>${debug.mode}</span></div>
          <div class="kv"><span>代理</span><span>${debug.endpoint}</span></div>
          <div class="kv"><span>模型</span><span>${debug.model}</span></div>
          <div class="kv"><span>健康</span><span>${debug.health}</span></div>
          <div class="kv"><span>最近请求</span><span>${debug.lastRequestId}</span></div>
          <div class="kv"><span>回退原因</span><span>${debug.lastFallbackReason}</span></div>
        </div>
      </div>
      <div class="section">
        <button class="ghost-btn" style="width:100%;" onclick="clearBetaCode()">清除试用口令</button>
      </div>
      <div class="notice">云端登录、家庭成员和隐私协议将在后续版本补齐。本原型用于验证核心自查路径。</div>
    </section>
  `, { title: "我的", subtitle: "访客模式" });
}

function aiDebugSummary() {
  const config = window.SYMPTOMMATE_AI_CONFIG || {};
  const debug = state.aiDebug || {};
  return {
    status: debug.loading ? "检查中" : debug.health?.ok ? "正常" : debug.error ? "异常" : "未检查",
    mode: debug.config?.mode || config.mode || aiAdapter.mode || "-",
    endpoint: debug.config?.proxyEndpoint || config.proxyEndpoint || "-",
    model: debug.health?.model || debug.config?.model || "-",
    health: debug.health?.ok ? "正常" : debug.error || "未检查",
    lastRequestId: debug.lastRequestId || "-",
    lastFallbackReason: debug.lastFallbackReason || "-",
  };
}

async function checkAiDebug() {
  const config = window.SYMPTOMMATE_AI_CONFIG || {};
  state.aiDebug.loading = true;
  state.aiDebug.error = "";
  render();
  try {
    const [publicConfig, health] = await Promise.all([
      fetchJson(config.configEndpoint),
      fetchJson(config.healthEndpoint),
    ]);
    state.aiDebug.config = publicConfig;
    state.aiDebug.health = health;
    state.aiDebug.checkedAt = new Date().toISOString();
    showToast("AI 接入状态正常");
  } catch (error) {
    state.aiDebug.error = "代理不可用";
    showToast("AI 接入状态异常");
  } finally {
    state.aiDebug.loading = false;
    render();
  }
}

async function fetchJson(url) {
  const headers = { Accept: "application/json" };
  if (state.betaAccess.code) headers["X-Beta-Code"] = state.betaAccess.code;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function verifyBetaCode(code) {
  const config = window.SYMPTOMMATE_AI_CONFIG || {};
  if (window.location?.protocol === "file:") return { ok: false, reason: "local_file" };
  if (!config.configEndpoint) return { ok: false, reason: "unavailable" };
  try {
    const response = await fetch(config.configEndpoint, {
      headers: {
        Accept: "application/json",
        "X-Beta-Code": code,
      },
    });
    if (response.ok) return { ok: true };
    if (response.status === 401) return { ok: false, reason: "unauthorized" };
    if (response.status === 429) return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "unavailable" };
  } catch (error) {
    return { ok: false, reason: "unavailable" };
  }
}

function betaVerificationMessage(reason) {
  const messages = {
    unauthorized: "试用口令不正确，请重新输入",
    rate_limited: "验证次数过多，请 1 分钟后再试",
    local_file: "本地 file:// 页面无法验证线上口令，请打开线上试用地址",
    unavailable: "暂时无法连接 AI 代理，请稍后再试",
  };
  return messages[reason] || messages.unavailable;
}

function labelForAnswer(key) {
  const map = {
    duration: "持续时间",
    severity: "严重程度",
    redFlags: "红线情况",
    group: "人群",
    impact: "生活影响",
  };
  return map[key] || "补充信息";
}

function confidenceColor(value) {
  if (value < 40) return "var(--red)";
  if (value < 70) return "var(--amber)";
  if (value < 90) return "var(--green)";
  return "var(--primary-dark)";
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function render() {
  if (!betaAccessEnabled()) {
    app.innerHTML = betaGateView();
    return;
  }
  const views = {
    home: homeView,
    chat: chatView,
    result: resultView,
    alert: alertView,
    prep: prepView,
    questions: questionsView,
    referral: referralView,
    history: historyView,
    analytics: analyticsView,
    mine: mineView,
  };
  app.innerHTML = views[state.view]();
}

render();
if (initialBetaCode) saveBetaCode(initialBetaCode);

window.state = state;
window.setView = setView;
window.openConsent = openConsent;
window.confirmConsent = confirmConsent;
window.startChat = startChat;
window.submitFreeText = submitFreeText;
window.answerQuestion = answerQuestion;
window.showToast = showToast;
window.clearHistory = clearHistory;
window.openHistory = openHistory;
window.saveHistoryFromResult = saveHistoryFromResult;
window.clearAnalyticsData = clearAnalyticsData;
window.checkAiDebug = checkAiDebug;
window.submitBetaAccess = submitBetaAccess;
window.clearBetaCode = clearBetaCode;
