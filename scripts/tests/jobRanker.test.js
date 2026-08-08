import { decodeRemoteAddress } from "../jobRanker.js";

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

console.log(`📋 [jobRanker.test.js] Job ranking / remote-address decoding unit tests`);

try {
  // ----------------------------------------------------
  // decodeRemoteAddress: IPv4 (family = '02')
  // ----------------------------------------------------
  assertEqual(
    "decodes plain IPv4 with port",
    decodeRemoteAddress("02", "0AFF00C5", "52225"),
    "10.255.0.197:52225",
  );
  assertEqual(
    "decodes plain IPv4 without port",
    decodeRemoteAddress("02", "0AFF00C5", null),
    "10.255.0.197",
  );

  // ----------------------------------------------------
  // decodeRemoteAddress: IPv6 (family = '18')
  // ----------------------------------------------------
  assertEqual(
    "decodes real IPv6 (non-mapped) address",
    decodeRemoteAddress("18", "20010db8000000000000000000000001", "443"),
    "2001:0db8:0000:0000:0000:0000:0000:0001:443",
  );

  // ----------------------------------------------------
  // decodeRemoteAddress: IPv4-mapped IPv6 (::ffff:a.b.c.d) — the real-world
  // common case reproduced from the clark75/QPFRDATA regression this
  // decoder was built to fix (see field_reference.md 2026-08-08 entry).
  // ----------------------------------------------------
  assertEqual(
    "renders IPv4-mapped IPv6 as plain IPv4 (regression: clark75 QZDASOINIT case)",
    decodeRemoteAddress("18", "00000000000000000000ffff0aff00c5", "52225"),
    "10.255.0.197:52225",
  );

  // ----------------------------------------------------
  // decodeRemoteAddress: unset / malformed
  // ----------------------------------------------------
  assertEqual("family X'00' (no socket) returns null", decodeRemoteAddress("00", "00000000", "0"), null);
  assertEqual("missing ipHex returns null", decodeRemoteAddress("02", "", "80"), null);
  assertEqual("missing ipHex (undefined) returns null", decodeRemoteAddress("02", undefined, "80"), null);
  assertEqual("unrecognized family returns null", decodeRemoteAddress("FF", "0AFF00C5", "80"), null);
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
