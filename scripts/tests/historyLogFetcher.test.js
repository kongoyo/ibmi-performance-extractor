import { historyLogRowToEvent, inferFullDate, buildLogWindow, fetchJobHistoryContext } from "../extraction/historyLogFetcher.js";

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

console.log(`📋 [historyLogFetcher.test.js] Live QSYS2.HISTORY_LOG_INFO fetch/decode unit tests`);

try {
  // ----------------------------------------------------
  // historyLogRowToEvent — rows reproduced verbatim (structure + values)
  // from a live query against clark75/QPFRDATA (2026-08-08 verification).
  // ----------------------------------------------------
  const connectRow = {
    MESSAGE_ID: "CPIAD09", MESSAGE_TYPE: "INFORMATIONAL", SEVERITY: 0,
    MESSAGE_TIMESTAMP: "2026-08-07 16:40:50.484540",
    FROM_USER: "CLARK", FROM_JOB_NAME: "QZDASOINIT", FROM_JOB_USER: "QUSER", FROM_JOB_NUMBER: "846143",
    MESSAGE_TEXT: "來自用戶端10.255.0.197的使用CLARK已連接到26/08/07 16:40:50上QSYS中的子系統QUSRWRK中的工作846143/QUSER/QZDASOINIT。",
    MESSAGE_SECOND_LEVEL_TEXT: null,
  };
  const connectEvent = historyLogRowToEvent(connectRow);
  assertEqual("connect: kind", connectEvent.kind, "connect");
  assertEqual("connect: date converted from timestamp", connectEvent.date, "08/07");
  assertEqual("connect: time converted from timestamp (drops fractional seconds)", connectEvent.time, "16:40:50");
  assertEqual("connect: jobNumber from structured column (no regex needed)", connectEvent.jobNumber, "846143");
  assertEqual("connect: requestUser from FROM_USER column", connectEvent.connect.requestUser, "CLARK");
  assertEqual("connect: clientIp extracted from localized (Chinese) MESSAGE_TEXT", connectEvent.connect.clientIp, "10.255.0.197");

  const connectRowEnglish = {
    ...connectRow,
    MESSAGE_TEXT: "User CLARK from client 10.255.0.197 connected to job 846143/QUSER/QZDASOINIT in subsystem QUSRWRK in QSYS on 26/08/07 16:40:50.",
  };
  assertEqual(
    "connect: clientIp extraction is language-agnostic (works on English text too)",
    historyLogRowToEvent(connectRowEnglish).connect.clientIp,
    "10.255.0.197",
  );

  const jobEndRow = {
    MESSAGE_ID: "CPF1164", MESSAGE_TYPE: "COMPLETION", SEVERITY: 0,
    MESSAGE_TIMESTAMP: "2026-08-07 19:25:15.036436",
    FROM_USER: "QUSER", FROM_JOB_NAME: "QZDASOINIT", FROM_JOB_USER: "QUSER", FROM_JOB_NUMBER: "846143",
    MESSAGE_TEXT: "工作846143/QUSER/QZDASOINIT已結束於26/08/07 (19:25:15)；使用210.744秒；結束碼為10 。",
    MESSAGE_SECOND_LEVEL_TEXT: null,
  };
  const jobEndEvent = historyLogRowToEvent(jobEndRow);
  assertEqual("jobEnd: kind", jobEndEvent.kind, "jobEnd");
  assertEqual("jobEnd: secondsUsed parsed from localized text", jobEndEvent.jobEnd.secondsUsed, 210.744);
  assertEqual("jobEnd: endCode parsed from localized text", jobEndEvent.jobEnd.endCode, "10");

  const jobStartRow = {
    MESSAGE_ID: "CPF1124", MESSAGE_TYPE: "INFORMATIONAL", SEVERITY: 0,
    MESSAGE_TIMESTAMP: "2026-08-07 16:40:29.919794",
    FROM_USER: "CLARK", FROM_JOB_NAME: "QPADEV0001", FROM_JOB_USER: "CLARK", FROM_JOB_NUMBER: "846338",
    MESSAGE_TEXT: "已在26/08/07的16:40:29時，於QSYS的子系統QINTER中啟動工作846338/CLARK/QPADEV0001。工作在26/08/07的16:40:29時進入系統。",
    MESSAGE_SECOND_LEVEL_TEXT: null,
  };
  assertEqual("jobStart: subsystem parsed from localized text", historyLogRowToEvent(jobStartRow).jobStart.subsystem, "QINTER");

  const unrecognizedMessageRow = {
    MESSAGE_ID: "CPF9999", MESSAGE_TYPE: "DIAGNOSTIC", SEVERITY: 40,
    MESSAGE_TIMESTAMP: "2026-08-07 17:00:00.000000",
    FROM_USER: "QUSER", FROM_JOB_NAME: "QZDASOINIT", FROM_JOB_USER: "QUSER", FROM_JOB_NUMBER: "846143",
    MESSAGE_TEXT: "Some diagnostic message this parser doesn't specifically model.",
    MESSAGE_SECOND_LEVEL_TEXT: null,
  };
  assertEqual("unrecognized message ID falls back to kind 'other' (not dropped)", historyLogRowToEvent(unrecognizedMessageRow).kind, "other");
  assertEqual("kind 'other' retains severity for surfacing warnings", historyLogRowToEvent(unrecognizedMessageRow).severity, 40);

  // ----------------------------------------------------
  // inferFullDate — year inference relative to a fixed "now"
  // ----------------------------------------------------
  const now = new Date(2026, 7, 8); // 2026-08-08
  assertEqual("inferFullDate: date in the past this year keeps current year", inferFullDate("08/07", now), { year: 2026, month: 8, day: 7 });
  assertEqual("inferFullDate: date in the future this year rolls back to last year", inferFullDate("12/25", now), { year: 2025, month: 12, day: 25 });

  // ----------------------------------------------------
  // buildLogWindow — bounded window, clipped to the calendar day
  // ----------------------------------------------------
  const win = buildLogWindow("08/07", "17:00:00", 60);
  assertEqual("buildLogWindow: 60min buffer before reference time", win.startTs, "2026-08-07 16:00:00");
  assertEqual("buildLogWindow: 60min buffer after reference time", win.endTs, "2026-08-07 18:00:00");

  const clippedWin = buildLogWindow("08/07", "00:30:00", 60);
  assertEqual("buildLogWindow: window is clipped to the start of the calendar day", clippedWin.startTs, "2026-08-07 00:00:00");

  // ----------------------------------------------------
  // fetchJobHistoryContext — against a mock dbManager, verifying it queries
  // a SCOPED window (not the whole day) and merges own + nearby events
  // ----------------------------------------------------
  const queriesRun = [];
  const mockDbManager = {
    executeQuery: async (hostId, sql) => {
      queriesRun.push(sql);
      if (sql.includes("FROM_JOB_NUMBER = '846143'")) {
        return { data: [connectRow, jobEndRow] };
      }
      if (sql.includes("MESSAGE_ID IN ('CPIAD09')")) {
        return {
          data: [
            connectRow,
            { ...connectRow, FROM_JOB_NAME: "QZRCSRVS", FROM_JOB_NUMBER: "846339", MESSAGE_TEXT: connectRow.MESSAGE_TEXT.replace("846143", "846339") },
          ],
        };
      }
      return { data: [] };
    },
  };

  const merged = await fetchJobHistoryContext(
    mockDbManager, "testHost",
    { jobName: "QZDASOINIT", jobUser: "QUSER", jobNumber: "846143", referenceTimes: ["16:45", "17:00", "19:30"] },
    "08/07",
  );
  assertEqual("fetchJobHistoryContext: merges own events + nearby sibling connect", merged.length, 3);
  assertEqual("fetchJobHistoryContext: excludes the target job itself from the nearby set", merged.filter((e) => e.jobNumber === "846339").length, 1);
  assertEqual(
    "fetchJobHistoryContext: first query window derives from referenceTimes (16:45), not the whole day",
    queriesRun[0].includes("2026-08-07 15:45:00"),
    true,
  );

  assertEqual(
    "fetchJobHistoryContext: rejects a non-numeric jobNumber (SQL-injection guard) instead of querying",
    await fetchJobHistoryContext(mockDbManager, "testHost", { jobName: "X", jobUser: "Y", jobNumber: "1;DROP TABLE", referenceTimes: ["10:00"] }, "08/07"),
    null,
  );

  // ----------------------------------------------------
  // Incremental widening: an attempt that finds only a connect (no jobEnd
  // yet — the exact gap this loop exists to close, since a long-running
  // job's end can land well outside a narrow initial window) should keep
  // widening by one hour at a time (not jump straight to the whole day)
  // until the end record is captured.
  // ----------------------------------------------------
  const emptyThenFoundQueries = [];
  let emptyAttempts = 0;
  const emptyThenFoundDbManager = {
    executeQuery: async (hostId, sql) => {
      emptyThenFoundQueries.push(sql);
      if (sql.includes("FROM_JOB_NUMBER = '900001'")) {
        emptyAttempts++;
        if (emptyAttempts === 1) return { data: [] }; // nothing at all yet
        if (emptyAttempts === 2) return { data: [connectRow] }; // connect found, but no end yet
        return { data: [connectRow, jobEndRow] }; // end finally captured on the 3rd (widest) attempt
      }
      return { data: [] };
    },
  };
  const expandCalls = [];
  const widened = await fetchJobHistoryContext(
    emptyThenFoundDbManager, "testHost",
    { jobName: "QZDASOINIT", jobUser: "QUSER", jobNumber: "900001", referenceTimes: ["12:00"] },
    "08/07",
    { initialBufferMinutes: 60, stepMinutes: 60, onExpand: (from, to) => expandCalls.push([from, to]) },
  );
  assertEqual("widening: makes 3 attempts before finding the jobEnd", emptyAttempts, 3);
  assertEqual("widening: expands one hour at a time, not straight to the whole day", expandCalls, [[60, 120], [120, 180]]);
  assertEqual("widening: keeps widening past a connect-only result until jobEnd is found", widened.length, 2);

  const neverFoundQueries = [];
  let neverFoundAttempts = 0;
  const neverFoundDbManager = {
    executeQuery: async (hostId, sql) => {
      neverFoundQueries.push(sql);
      if (sql.includes("FROM_JOB_NUMBER")) neverFoundAttempts++;
      return { data: [] };
    },
  };
  const neverFoundExpandCalls = [];
  const notFound = await fetchJobHistoryContext(
    neverFoundDbManager, "testHost",
    { jobName: "QZDASOINIT", jobUser: "QUSER", jobNumber: "900002", referenceTimes: ["12:00"] },
    "08/07",
    { initialBufferMinutes: 60, stepMinutes: 60, maxBufferMinutes: 180, onExpand: (from, to) => neverFoundExpandCalls.push([from, to]) },
  );
  assertEqual("widening: stops at maxBufferMinutes when nothing is ever found", notFound, []);
  assertEqual("widening: does not expand past maxBufferMinutes", neverFoundExpandCalls, [[60, 120], [120, 180]]);
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
