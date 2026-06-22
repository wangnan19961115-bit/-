// Non-secret browser config. Keep model keys in .env on the backend only.
window.SYMPTOMMATE_AI_CONFIG = {
  // Available modes: "simulated", "llm_shadow", "llm".
  mode: "llm",
  configEndpoint: "http://127.0.0.1:8788/api/config",
  healthEndpoint: "http://127.0.0.1:8788/api/health",
  proxyEndpoint: "http://127.0.0.1:8788/api/ai/understand",
  timeoutMs: 7000,
};
