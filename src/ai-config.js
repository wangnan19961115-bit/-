// Non-secret browser config. Keep model keys in .env on the backend only.
window.SYMPTOMMATE_AI_CONFIG = {
  // Available modes: "simulated", "llm_shadow", "llm".
  mode: "simulated",
  grayModeQueryParam: "ai",
  configEndpoint: "https://symptommate-ai-proxy.onrender.com/api/config",
  healthEndpoint: "https://symptommate-ai-proxy.onrender.com/api/health",
  proxyEndpoint: "https://symptommate-ai-proxy.onrender.com/api/ai/understand",
  localProxyEndpoint: "http://127.0.0.1:8788/api/ai/understand",
  timeoutMs: 7000,
  betaCodeStorageKey: "symptomMateBetaCode",
};
