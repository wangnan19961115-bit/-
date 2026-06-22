const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const warnings = [];

const forbiddenFiles = [
  "deepseekapikey.txt",
  "apikey.txt",
  "openaiapikey.txt",
  "api-key.txt",
];

const trackedFiles = listTrackedFiles();
const trackedSet = new Set(trackedFiles.map(normalizePath));

for (const file of forbiddenFiles) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) failures.push(`Sensitive-looking file exists: ${file}`);
}

for (const file of [".env", ".env.local", "logs/ai-proxy.log"]) {
  if (trackedSet.has(normalizePath(file))) failures.push(`Sensitive/runtime file is tracked: ${file}`);
}

for (const file of trackedFiles) {
  if (shouldSkipContentScan(file)) continue;
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    warnings.push(`Tracked file is not available on disk, skipped content scan: ${file}`);
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  const matches = content.match(/sk-[A-Za-z0-9_-]{20,}/g) || [];
  const realMatches = matches.filter((value) => value !== "sk-your-key");
  if (realMatches.length) failures.push(`Possible API key in tracked file: ${file}`);
}

if (!fs.existsSync(path.join(root, ".env.example"))) failures.push(".env.example is missing");
if (!isIgnored(".env")) warnings.push(".env does not appear to be ignored by git");
if (!isIgnored("logs/ai-proxy.log")) warnings.push("logs/ai-proxy.log does not appear to be ignored by git");

console.log("SymptomMate Secret Check");
console.log("========================");

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("All secret checks passed.");

function listTrackedFiles() {
  try {
    return childProcess
      .execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  } catch (error) {
    failures.push(`Unable to list git tracked files: ${error.message}`);
    return [];
  }
}

function isIgnored(file) {
  try {
    childProcess.execFileSync("git", ["check-ignore", "-q", file], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

function shouldSkipContentScan(file) {
  return /\.(png|jpg|jpeg|gif|webp|ico|docx|pdf)$/i.test(file);
}

function normalizePath(file) {
  return file.replace(/\\/g, "/");
}
