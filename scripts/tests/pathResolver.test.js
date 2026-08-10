import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SKILL_ROOT, resolveDataAndOutputDirs } from "../core/pathResolver.js";

const green = "\x1b[32m";
const red = "\x1b[31m";
const reset = "\x1b[0m";

let passedTests = 0;
let failedTests = 0;

function assertEqual(testName, actual, expected) {
  if (actual === expected) {
    console.log(`  [${green}PASS${reset}] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [${red}FAIL${reset}] ${testName}: Calculated = ${JSON.stringify(actual)}, Expected = ${JSON.stringify(expected)}`);
    failedTests++;
  }
}

function assertThrows(testName, fn) {
  try {
    fn();
    console.error(`  [${red}FAIL${reset}] ${testName}: expected an exception, none was thrown`);
    failedTests++;
  } catch {
    console.log(`  [${green}PASS${reset}] ${testName}`);
    passedTests++;
  }
}

// Unmistakable, disposable fixture names so this never collides with real
// host data — cleaned up unconditionally at the end of the run.
const TEST_HOST_ID = "__unittest_host__";
const TEST_HOST = "9.9.9.9";
const TEST_LIB = "__UNITTEST_LIB__";

function cleanup() {
  fs.rmSync(path.join(SKILL_ROOT, "data", TEST_HOST_ID), { recursive: true, force: true });
  fs.rmSync(path.join(SKILL_ROOT, "outputs", TEST_HOST_ID), { recursive: true, force: true });
}

console.log(`📋 [pathResolver.test.js] Path resolution unit tests`);

try {
  // ----------------------------------------------------
  // SKILL_ROOT: two levels up from scripts/tests/
  // ----------------------------------------------------
  const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  assertEqual("SKILL_ROOT resolves to the project root", SKILL_ROOT, expectedRoot);

  // ----------------------------------------------------
  // Directory layout: keyed by hostId (not hostConfig.host), per
  // references/output-conventions.md.
  // ----------------------------------------------------
  cleanup();
  const hostConfig = { host: TEST_HOST, library: "DEFAULT_LIB" };
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, TEST_HOST_ID, TEST_LIB);

  assertEqual(
    "dataDir is keyed by hostId, not hostConfig.host",
    dataDir,
    path.join(SKILL_ROOT, "data", TEST_HOST_ID, TEST_LIB) + path.sep,
  );
  assertEqual(
    "outDir is keyed by hostId, not hostConfig.host",
    outDir,
    path.join(SKILL_ROOT, "outputs", TEST_HOST_ID, TEST_LIB) + path.sep,
  );
  assertEqual("dataDir is created on disk", fs.existsSync(dataDir), true);
  assertEqual("outDir is created on disk", fs.existsSync(outDir), true);

  // ----------------------------------------------------
  // library argument takes priority over hostConfig.library
  // ----------------------------------------------------
  const explicit = resolveDataAndOutputDirs(hostConfig, TEST_HOST_ID, "EXPLICIT_LIB");
  assertEqual(
    "explicit library argument overrides hostConfig.library",
    explicit.dataDir,
    path.join(SKILL_ROOT, "data", TEST_HOST_ID, "EXPLICIT_LIB") + path.sep,
  );

  // ----------------------------------------------------
  // Falls back to hostConfig.library when no library argument given
  // ----------------------------------------------------
  const fallback = resolveDataAndOutputDirs(hostConfig, TEST_HOST_ID, undefined);
  assertEqual(
    "falls back to hostConfig.library when library arg is omitted",
    fallback.dataDir,
    path.join(SKILL_ROOT, "data", TEST_HOST_ID, "DEFAULT_LIB") + path.sep,
  );

  // ----------------------------------------------------
  // Throws when neither the argument nor hostConfig.library is set
  // ----------------------------------------------------
  assertThrows(
    "throws when library is missing from both argument and hostConfig",
    () => resolveDataAndOutputDirs({ host: TEST_HOST }, TEST_HOST_ID, undefined),
  );
} finally {
  cleanup();
}

console.log(`\n📊 Summary: ${passedTests} passed, ${failedTests} failed`);
if (failedTests > 0) {
  console.error(`${red}${failedTests} TEST(S) FAILED.${reset}`);
  process.exit(1);
} else {
  console.log(`${green}ALL ${passedTests} TESTS PASSED SUCCESSFULLY!${reset}`);
}
