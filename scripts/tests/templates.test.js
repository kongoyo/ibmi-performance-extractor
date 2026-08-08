/**
 * Unit tests for reporting/templates.js
 *
 * getHtmlTemplate / getCssAsset / getJsAsset / getRcaSection each read a
 * static file from scripts/reporting/assets/ and return its text content.
 */
import { getHtmlTemplate, getCssAsset, getJsAsset, getRcaSection } from "../reporting/templates.js";

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

console.log("\n📋 [templates.test.js] asset reader unit tests");

{
  const html = getHtmlTemplate();
  assert("getHtmlTemplate returns non-empty string", typeof html === "string" && html.length > 0);
  assert("getHtmlTemplate looks like HTML", html.includes("<html") || html.includes("<!DOCTYPE") || html.includes("<!doctype"));
}

{
  const css = getCssAsset();
  assert("getCssAsset returns non-empty string", typeof css === "string" && css.length > 0);
}

{
  const js = getJsAsset();
  assert("getJsAsset returns non-empty string", typeof js === "string" && js.length > 0);
}

{
  const rca = getRcaSection();
  assert("getRcaSection returns non-empty string", typeof rca === "string" && rca.length > 0);
}

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log(`ALL ${passed} TESTS PASSED SUCCESSFULLY!`);
} else {
  console.error(`${failed} TEST(S) FAILED.`);
  process.exit(1);
}
