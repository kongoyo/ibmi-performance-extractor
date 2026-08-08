import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for the assets
const ASSETS_DIR = path.join(__dirname, "assets");

/**
 * Utility function to read a static asset file.
 * @param {string} filename
 * @returns {string}
 */
function readAsset(filename) {
  const filePath = path.join(ASSETS_DIR, filename);
  return fs.readFileSync(filePath, "utf-8");
}

export function getHtmlTemplate() {
  return readAsset("template.html");
}

export function getCssAsset() {
  return readAsset("style.css");
}

export function getJsAsset() {
  return readAsset("app.js");
}

export function getRcaSection() {
  return readAsset("rca_section.html");
}
