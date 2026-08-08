import { safeSubstitute, formatVal, parseCliArgs } from "../reporting/generateReport.js";
import { calculateStats, getPanelHeaders } from "../reporting/dataProcessor.js";

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
    console.error(
      `  [${red}FAIL${reset}] ${testName}: Calculated = ${JSON.stringify(
        actual
      )}, Expected = ${JSON.stringify(expected)}`
    );
    failedTests++;
  }
}

function assertDeepEqual(testName, actual, expected) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  [${green}PASS${reset}] ${testName}`);
    passedTests++;
  } else {
    console.error(
      `  [${red}FAIL${reset}] ${testName}: Calculated = ${actualStr}, Expected = ${expectedStr}`
    );
    failedTests++;
  }
}

console.log(`📋 [generateReport.test.js] Report generator unit tests`);

// ----------------------------------------------------
// Test 1: safeSubstitute
// ----------------------------------------------------
const template = "Hello $host on $lib. Welcome to ${date_range}. Escaped $$ here, and $missing placeholder.";
const mapping = {
  host: "clark75",
  lib: "QPFRDATA",
  date_range: "07/12 ~ 07/14",
};
const expectedHtml = "Hello clark75 on QPFRDATA. Welcome to 07/12 ~ 07/14. Escaped $ here, and $missing placeholder.";
assertEqual(
  "safeSubstitute replaces placeholders and escapes $$ properly",
  safeSubstitute(template, mapping),
  expectedHtml
);

// ----------------------------------------------------
// Test 2: formatVal
// ----------------------------------------------------
assertEqual("formatVal handles undefined/null", formatVal(null, "Rsp", "val1"), "N/A");
assertEqual("formatVal Rsp val1 (float with commas & 2 decimals)", formatVal(1234.567, "Rsp", "val1"), "1,234.57");
assertEqual("formatVal Tot val1 (integer with commas)", formatVal(1234, "Tot", "val1"), "1,234");
assertEqual("formatVal Count val2 (float with commas & 2 decimals)", formatVal(12.345, "Count", "val2"), "12.35");
assertEqual("formatVal Int val2 < 100 (float with commas & 2 decimals)", formatVal(99.123, "Int", "val2"), "99.12");
assertEqual("formatVal Int val2 >= 100 (float with commas but no extra decimals specification)", formatVal(101.5, "Int", "val2"), "101.5");
assertEqual("formatVal Int val2 >= 100 with commas", formatVal(12345.6, "Int", "val2"), "12,345.6");

// ----------------------------------------------------
// Test 3: calculateStats
// ----------------------------------------------------
const dates = ["07/12", "07/13"];
const times = ["10:00", "10:15", "10:30"];
const dataByDate = {
  "07/12": {
    Count: [100, 250, 150],
    Rsp: [0.1, 0.5, 0.3],
  },
  "07/13": {
    Count: [300, 200, 100],
    Rsp: [0.2, 0.4, 0.6],
  },
};
const metrics = [
  { id: "chart-count", key: "Count", unit: "次" },
  { id: "chart-rsp", key: "Rsp", unit: "秒" },
];

const stats = calculateStats(dates, times, dataByDate, metrics);
const expectedStats = {
  Count: {
    "07/12": { max: 250, max_time: "10:15", avg: 166.67 },
    "07/13": { max: 300, max_time: "10:00", avg: 200 },
  },
  Rsp: {
    "07/12": { max: 0.5, max_time: "10:15", avg: 0.3 },
    "07/13": { max: 0.6, max_time: "10:30", avg: 0.4 },
  },
};
assertDeepEqual("calculateStats correctly calculates max, max_time, and average", stats, expectedStats);

// ----------------------------------------------------
// Test 4: parseCliArgs
// ----------------------------------------------------
const argv = [
  "--input",
  "data/clark75/perf_0714.json",
  "--output",
  "outputs/clark75/perf_0714.html",
  "--host=clark75",
  "--lib=QPFRDATA",
  "--rca",
];
const parsed = parseCliArgs(argv);
const expectedParsed = {
  input: "data/clark75/perf_0714.json",
  output: "outputs/clark75/perf_0714.html",
  host: "clark75",
  lib: "QPFRDATA",
  date: "ALL",
  rca: true,
};
assertDeepEqual("parseCliArgs parses space-separated, equal-separated, and flag arguments", parsed, expectedParsed);

// ----------------------------------------------------
// Test 5: getPanelHeaders
// ----------------------------------------------------
const panelCases = [
  ["Rsp", "回應時間", "實體 I/O 次數"],
  ["Count", "交易次數", "平均回應時間"],
  ["Dsk", "I/O 次數", "CPU 耗時"],
  ["Usr", "分頁缺失", "CPU 耗時"],
  ["Tot", "CPU 耗時", "總 I/O 次數"],
  ["Int", "CPU 耗時", "交易回應時間"],
  ["Bch", "CPU 耗時", "實體 I/O 次數"],
];
for (const [key, val_header, last_header] of panelCases) {
  const headers = getPanelHeaders(key);
  assertEqual(`getPanelHeaders(${key}) val_header`, headers.val_header, val_header);
  assertEqual(`getPanelHeaders(${key}) last_header`, headers.last_header, last_header);
}
const fallbackHeaders = getPanelHeaders("Unknown");
assertEqual("getPanelHeaders fallback val_header", fallbackHeaders.val_header, "數值 1");
assertEqual("getPanelHeaders fallback last_header", fallbackHeaders.last_header, "數值 2");
assertEqual("getPanelHeaders fallback val_unit", fallbackHeaders.val_unit, "");

console.log(`\n📊 Summary: ${passedTests} passed, ${failedTests} failed`);
if (failedTests > 0) {
  console.error(`${red}${failedTests} TEST(S) FAILED.${reset}`);
  process.exit(1);
} else {
  console.log(`${green}ALL ${passedTests} TESTS PASSED SUCCESSFULLY!${reset}`);
}
