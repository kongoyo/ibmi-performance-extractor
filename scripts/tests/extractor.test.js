import { PerformanceDataExtractor, discoverLibrariesForDates, julianToDateStr } from "../extractor.js";

const green = "\x1b[32m";
const red = "\x1b[31m";
const reset = "\x1b[0m";

let passedTests = 0;
let failedTests = 0;

function assertEqual(testName, actual, expected) {
  const isMatched = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatched) {
    console.log(`  [${green}PASS${reset}] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [${red}FAIL${reset}] ${testName}: Calculated = ${JSON.stringify(actual)}, Expected = ${JSON.stringify(expected)}`);
    failedTests++;
  }
}

console.log(`📋 [extractor.test.js] Extractor unit tests`);

try {
  // ----------------------------------------------------
  // julianToDateStr (non-leap-year model)
  // ----------------------------------------------------
  assertEqual("julianToDateStr('001') == 01/01", julianToDateStr("001"), "01/01");
  assertEqual("julianToDateStr('032') == 02/01 (Jan has 31 days)", julianToDateStr("032"), "02/01");
  assertEqual("julianToDateStr('059') == 02/28 (last day of Feb, non-leap)", julianToDateStr("059"), "02/28");
  assertEqual("julianToDateStr('060') == 03/01", julianToDateStr("060"), "03/01");
  assertEqual("julianToDateStr('194') == 07/13 (real KTB benchmark partition Q194)", julianToDateStr("194"), "07/13");
  assertEqual("julianToDateStr('217') == 08/05 (real QPFRDATA partition Q217)", julianToDateStr("217"), "08/05");
  assertEqual("julianToDateStr('365') == 12/31", julianToDateStr("365"), "12/31");

  // ----------------------------------------------------
  // PerformanceDataExtractor: standardTimes generation (96 x 15-min slots)
  // ----------------------------------------------------
  const extractor = new PerformanceDataExtractor(/* dbManager */ null, "testHost", "TESTLIB");
  assertEqual("standardTimes has 96 entries (24h x 4 per hour)", extractor.standardTimes.length, 96);
  assertEqual("standardTimes[0] == 00:00", extractor.standardTimes[0], "00:00");
  assertEqual("standardTimes[4] == 01:00", extractor.standardTimes[4], "01:00");
  assertEqual("standardTimes[95] == 23:45", extractor.standardTimes[95], "23:45");

  // ----------------------------------------------------
  // discoverLibrariesForDates: ranks libraries by how many of their
  // partitions fall inside the target dates, against a mocked dbManager
  // (no live host connection needed for this pure grouping/ranking logic).
  // ----------------------------------------------------
  const mockDbManager = {
    executeQuery: async () => ({
      data: [
        { LIBRARY: "KTB", PARTITION_NAME: "Q194000017" }, // 07/13 - not in target range
        { LIBRARY: "KTB", PARTITION_NAME: "Q195000017" }, // 07/14 - not in target range
        { LIBRARY: "QPFRDATA", PARTITION_NAME: "Q217000017" }, // 08/05
        { LIBRARY: "QPFRDATA", PARTITION_NAME: "Q218000017" }, // 08/06
        { LIBRARY: "QPFRDATA", PARTITION_NAME: "Q219000017" }, // 08/07
        { LIBRARY: "OTHERLIB", PARTITION_NAME: "Q217000099" }, // 08/05 - one match
      ],
    }),
  };

  const candidates = await discoverLibrariesForDates(mockDbManager, "testHost", ["08/05", "08/06", "08/07"]);
  assertEqual("discoverLibrariesForDates excludes libraries with zero matching partitions", candidates.some(c => c.library === "KTB"), false);
  assertEqual("discoverLibrariesForDates ranks the best-matching library first", candidates[0], { library: "QPFRDATA", matchCount: 3 });
  assertEqual("discoverLibrariesForDates includes a lower-ranked partial match", candidates[1], { library: "OTHERLIB", matchCount: 1 });

  const noMatches = await discoverLibrariesForDates(mockDbManager, "testHost", ["01/01"]);
  assertEqual("discoverLibrariesForDates returns an empty list when nothing matches", noMatches, []);
} catch (e) {
  console.error(`${red}💥 Unexpected error during tests:${reset}`, e);
  failedTests++;
}

console.log(`\n📊 Summary: ${passedTests} passed, ${failedTests} failed`);
if (failedTests > 0) {
  console.error(`${red}${failedTests} TEST(S) FAILED.${reset}`);
  process.exit(1);
} else {
  console.log(`${green}ALL ${passedTests} TESTS PASSED SUCCESSFULLY!${reset}`);
}
