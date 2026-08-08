/**
 * Unit tests for reporting/insightsEngine.js
 *
 * generateInsights(key, absMax, maxD, absMaxTime) → [analysis, recommendation]
 *
 * Coverage targets:
 *   - Tot > 70   (警告分支)
 *   - Tot <= 70  (正常分支)
 *   - Rsp > 2.0  (警告分支)
 *   - Rsp <= 2.0 (正常分支)
 *   - Usr > 50   (警告分支)
 *   - Usr <= 50  (正常分支)
 *   - fallback (其他 key)
 */
import { generateInsights } from "../reporting/insightsEngine.js";

const green = "\x1b[32m";
const red = "\x1b[31m";
const reset = "\x1b[0m";

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ${green}[PASS]${reset} ${description}`);
    passed++;
  } else {
    console.log(`  ${red}[FAIL]${reset} ${description}`);
    failed++;
  }
}

function assertIncludes(description, haystack, needle) {
  assert(description, typeof haystack === "string" && haystack.includes(needle));
}

console.log("\n📋 [insightsEngine.test.js] generateInsights unit tests");

// --- Tot > 70 ---
{
  const [analysis, rec] = generateInsights("Tot", 85, "07/14", "10:00");
  assertIncludes("Tot > 70: analysis 含警告關鍵字", analysis, "吃緊");
  assertIncludes("Tot > 70: analysis 含 absMax 數值", analysis, "85");
  assertIncludes("Tot > 70: analysis 含 maxD", analysis, "07/14");
  assertIncludes("Tot > 70: analysis 含 absMaxTime", analysis, "10:00");
  assertIncludes("Tot > 70: recommendation 含 LPAR", rec, "LPAR");
  assert("Tot > 70: 回傳陣列長度為 2", Array.isArray(generateInsights("Tot", 85, "07/14", "10:00")) && generateInsights("Tot", 85, "07/14", "10:00").length === 2);
}

// --- Tot <= 70 ---
{
  const [analysis, rec] = generateInsights("Tot", 15, "07/14", "14:30");
  assertIncludes("Tot <= 70: analysis 含充沛關鍵字", analysis, "充沛");
  assertIncludes("Tot <= 70: analysis 含 absMax 數值", analysis, "15");
  assertIncludes("Tot <= 70: recommendation 含維持現有", rec, "維持現有");
}

// --- Rsp > 2.0 ---
{
  const [analysis, rec] = generateInsights("Rsp", 3.5, "07/14", "09:15");
  assertIncludes("Rsp > 2.0: analysis 含延遲警告", analysis, "延遲");
  assertIncludes("Rsp > 2.0: analysis 含 absMax", analysis, "3.5");
  assertIncludes("Rsp > 2.0: recommendation 含 Lock", rec, "Lock");
}

// --- Rsp <= 2.0 ---
{
  const [analysis, rec] = generateInsights("Rsp", 0.25, "07/14", "08:00");
  assertIncludes("Rsp <= 2.0: analysis 含極佳關鍵字", analysis, "極佳");
  assertIncludes("Rsp <= 2.0: analysis 含 absMax", analysis, "0.25");
  assertIncludes("Rsp <= 2.0: recommendation 含索引", rec, "索引");
}

// --- Usr > 50 ---
{
  const [analysis, rec] = generateInsights("Usr", 120, "07/14", "11:00");
  assertIncludes("Usr > 50: analysis 含置換警告", analysis, "置換");
  assertIncludes("Usr > 50: analysis 含 absMax", analysis, "120");
  assertIncludes("Usr > 50: recommendation 含 QPFRADJ", rec, "QPFRADJ");
}

// --- Usr <= 50 ---
{
  const [analysis, rec] = generateInsights("Usr", 3, "07/14", "06:00");
  assertIncludes("Usr <= 50: analysis 含合理關鍵字", analysis, "合理");
  assertIncludes("Usr <= 50: analysis 含 absMax", analysis, "3");
  assertIncludes("Usr <= 50: recommendation 含維持現狀", rec, "維持現狀");
}

// --- fallback key ---
{
  const [analysis, rec] = generateInsights("Dsk", 42, "07/14", "15:00");
  assertIncludes("fallback: analysis 含跨日最大值", analysis, "42");
  assertIncludes("fallback: recommendation 含例行點檢", rec, "例行點檢");
}

// --- 邊界值：Tot 恰好等於 70 應走正常分支 ---
{
  const [analysis] = generateInsights("Tot", 70, "07/14", "12:00");
  assertIncludes("Tot = 70 (boundary): 走正常分支", analysis, "充沛");
}

// --- 邊界值：Rsp 恰好等於 2.0 應走正常分支 ---
{
  const [analysis] = generateInsights("Rsp", 2.0, "07/14", "12:00");
  assertIncludes("Rsp = 2.0 (boundary): 走正常分支", analysis, "極佳");
}

// --- 邊界值：Usr 恰好等於 50 應走正常分支 ---
{
  const [analysis] = generateInsights("Usr", 50, "07/14", "12:00");
  assertIncludes("Usr = 50 (boundary): 走正常分支", analysis, "合理");
}

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log(`ALL ${passed} TESTS PASSED SUCCESSFULLY!`);
} else {
  console.error(`${failed} TEST(S) FAILED.`);
  process.exit(1);
}
