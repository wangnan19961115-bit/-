const fs = require("fs");
const vm = require("vm");
const { spawnSync } = require("child_process");

const syntaxFiles = [
  "src/app.js",
  "src/symptom-config.js",
  "src/medical-rules.js",
  "src/ai-adapter.js",
  "scripts/qa-config-check.js",
  "scripts/qa-medical-rules-check.js",
  "scripts/qa-acceptance-check.js",
  "scripts/qa-boundary-check.js",
  "scripts/qa-ai-proxy-check.js",
  "scripts/qa-rag-check.js",
  "scripts/qa-medical-safety-check.js",
  "scripts/qa-production-readiness-check.js",
  "scripts/qa-secret-check.js",
  "scripts/smoke-ai-proxy-live.js",
  "scripts/e2e-ai-proxy-check.js",
  "scripts/browser-e2e-check.js",
];

function checkSyntax(file) {
  const code = fs.readFileSync(file, "utf8");
  new vm.Script(code, { filename: file });
}

function freshRequire(file) {
  for (const key of Object.keys(require.cache)) {
    if (key.includes("\\src\\") || key.includes("/src/") || key.includes("\\scripts\\") || key.includes("/scripts/")) {
      delete require.cache[key];
    }
  }
  const resolved = require.resolve(`../${file}`);
  delete require.cache[resolved];
  return require(resolved);
}

function runScript(file) {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  process.exit = (code = 0) => {
    const error = new Error(`process.exit(${code})`);
    error.exitCode = code;
    throw error;
  };

  try {
    freshRequire(file);
    if (process.exitCode && process.exitCode !== 0) {
      throw new Error(`${file} set process.exitCode=${process.exitCode}`);
    }
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
  }
}

function runNodeFile(file) {
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} exited with ${result.status}`);
}

console.log("SymptomMate Full QA");
console.log("==================");

for (const file of syntaxFiles) {
  console.log(`\n> syntax ${file}`);
  checkSyntax(file);
}

for (const file of [
  "scripts/qa-config-check.js",
  "scripts/qa-medical-rules-check.js",
  "scripts/qa-acceptance-check.js",
  "scripts/qa-boundary-check.js",
  "scripts/qa-ai-proxy-check.js",
  "scripts/qa-rag-check.js",
  "scripts/qa-medical-safety-check.js",
  "scripts/qa-production-readiness-check.js",
  "scripts/qa-secret-check.js",
]) {
  console.log(`\n> run ${file}`);
  runScript(file);
}

console.log("\n> run scripts/e2e-ai-proxy-check.js");
runNodeFile("scripts/e2e-ai-proxy-check.js");

console.log("\nAll QA checks passed.");
