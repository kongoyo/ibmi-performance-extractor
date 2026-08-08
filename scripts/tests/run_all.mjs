/**
 * Coverage runner: imports all test suites sequentially so that c8 can
 * instrument all source modules in the same process.
 *
 * Run with:  npx c8 node scripts/tests/run_all.mjs
 */
import "../tests/pathResolver.test.js";
import "../tests/extractor.test.js";
import "../tests/jobRanker.test.js";
import "../tests/dsplogParser.test.js";
import "../tests/historyLogFetcher.test.js";
import "../tests/generateReport.test.js";
