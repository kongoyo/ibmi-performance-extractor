import { parseDsplog, findJobEvents, findNearbyConnects, describeEndCode } from "../analysis/dsplogParser.js";

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

// Synthetic fixture mirroring the real V7R5 QHST dump format (fictitious
// job/user/IP values) — deliberately includes a page-break banner landing
// mid-continuation and a stray "X." highlight-marker line, both of which
// must be transparently handled without corrupting the parsed fields.
const FIXTURE = `
 5770SS1 V7R5M0 220415                                   History Log                 TESTHOST 26/08/08 11:42:48        Page  0001
MSGID    SEV MSG TYPE
CPF1124  00  INFO         Message . . . . :   Job 900001/TESTUSR/QPADEV0009 started on 26/08/07 at 09:15:00 in subsystem QINTER in
                            QSYS. Job entered system on 26/08/07 at 09:15:00.
                                                                                                       X
                      QPADEV0009 TESTUSR    900001 QWTPIIPP     0000 26/08/07 09:15:00.100000 TESTUSR
CPIAD09  00  INFO         Message . . . . :   User TESTUSR from client 10.1.2.3 connected to job 900002/QUSER/QZDASOINIT in
                            subsystem QUSRWRK in QSYS on 26/08/07 09:15:20.
                      QZDASOINIT QUSER      900002 QZBSSECR     0000 26/08/07 09:15:20.484540 TESTUSR
CPIAD09  00  INFO         Message . . . . :   User TESTUSR from client 10.1.2.3 connected to job 900003/QUSER/QZRCSRVS in
 5770SS1 V7R5M0 220415                                   History Log                 TESTHOST 26/08/08 11:42:48        Page  0002
MSGID    SEV MSG TYPE
                            subsystem QUSRWRK in QSYS on 26/08/07 09:15:21.
                      QZRCSRVS   QUSER      900003 QZBSSECR     0000 26/08/07 09:15:21.100000 TESTUSR
CPIAD09  00  INFO         Message . . . . :   User OTHERUSR from client 10.9.9.9 connected to job 900099/QUSER/QZDASOINIT in
                            subsystem QUSRWRK in QSYS on 26/08/07 14:00:00.
                      QZDASOINIT QUSER      900099 QZBSSECR     0000 26/08/07 14:00:00.100000 OTHERUSR
CPF1164  00  COMPLETION   Message . . . . :   Job 900002/QUSER/QZDASOINIT ended on 26/08/07 at 09:45:00; 33.5 seconds used; end
                            code 10
                                                                                                       X.
                          Cause . . . . . :   Job 900002/QUSER/QZDASOINIT completed on 26/08/07 at 09:45:00 after it used 33.5
                            seconds processing unit time. The maximum temporary storage used was 12 megabytes. The job had ending
                            code 10. The job ended after 1 routing steps with a secondary ending code of 0.
                      QZDASOINIT QUSER      900002 QWTMCEOJ     0000 26/08/07 09:45:00.036436 QUSER
`;

console.log(`📋 [dsplogParser.test.js] QHST/DSPLOG parser unit tests`);

try {
  const events = parseDsplog(FIXTURE);

  // ----------------------------------------------------
  // Basic event extraction, including across a page-break banner landing
  // mid-continuation (900003's connect message).
  // ----------------------------------------------------
  assertEqual("parses expected number of events", events.length, 5);

  const jobStart = events.find((e) => e.kind === "jobStart");
  assertEqual("jobStart: jobNumber", jobStart.jobNumber, "900001");
  assertEqual("jobStart: date converted to MM/DD", jobStart.date, "08/07");
  assertEqual("jobStart: time", jobStart.time, "09:15:00");
  assertEqual("jobStart: subsystem", jobStart.jobStart.subsystem, "QINTER");

  const connect900002 = events.find((e) => e.kind === "connect" && e.jobNumber === "900002");
  assertEqual("connect: requestUser", connect900002.connect.requestUser, "TESTUSR");
  assertEqual("connect: clientIp", connect900002.connect.clientIp, "10.1.2.3");
  assertEqual("connect: jobName", connect900002.jobName, "QZDASOINIT");

  const connect900003 = events.find((e) => e.kind === "connect" && e.jobNumber === "900003");
  assertEqual(
    "connect split across a page-break banner still parses correctly",
    connect900003 && connect900003.connect.clientIp,
    "10.1.2.3",
  );
  assertEqual("connect split across page-break: time", connect900003 && connect900003.time, "09:15:21");

  const jobEnd = events.find((e) => e.kind === "jobEnd");
  assertEqual("jobEnd: secondsUsed (parsed as number)", jobEnd.jobEnd.secondsUsed, 33.5);
  assertEqual("jobEnd: endCode extracted despite stray 'X.' junk line before Cause", jobEnd.jobEnd.endCode, "10");
  assertEqual("jobEnd: text stops at Cause section (no Cause prose leaking into fields)", jobEnd.jobNumber, "900002");

  // ----------------------------------------------------
  // findJobEvents: exact job-identity match only
  // ----------------------------------------------------
  const ownEvents = findJobEvents(events, "QZDASOINIT", "QUSER", "900002");
  assertEqual("findJobEvents finds both connect and jobEnd for the exact job instance", ownEvents.length, 2);
  assertEqual(
    "findJobEvents excludes a different job number with the same name/user",
    findJobEvents(events, "QZDASOINIT", "QUSER", "900099").every((e) => e.jobNumber === "900099"),
    true,
  );

  // ----------------------------------------------------
  // findNearbyConnects: same user/IP within a time window, excluding
  // unrelated users and out-of-window/out-of-date connects
  // ----------------------------------------------------
  const nearby = findNearbyConnects(events, {
    requestUser: "TESTUSR", clientIp: "10.1.2.3", date: "08/07", time: "09:15:20", windowMinutes: 5,
  });
  assertEqual("findNearbyConnects finds the sibling QZRCSRVS connect within the window", nearby.some((e) => e.jobNumber === "900003"), true);
  assertEqual("findNearbyConnects excludes a different user's connect", nearby.some((e) => e.jobNumber === "900099"), false);

  const nearbyTight = findNearbyConnects(events, {
    requestUser: "TESTUSR", clientIp: "10.1.2.3", date: "08/07", time: "09:15:20", windowMinutes: 0.01,
  });
  assertEqual("findNearbyConnects respects a tight window (excludes the 1s-later sibling)", nearbyTight.length, 1);

  // ----------------------------------------------------
  // describeEndCode
  // ----------------------------------------------------
  assertEqual("describeEndCode(0) is a normal completion", describeEndCode(0), "正常結束");
  assertEqual("describeEndCode(10) mentions controlled ending", describeEndCode(10).includes("受控結束"), true);
  assertEqual("describeEndCode(unknown) falls back gracefully", describeEndCode(999).includes("未知結束碼"), true);
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
