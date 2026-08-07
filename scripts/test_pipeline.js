import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  SKILL_ROOT,
  parseArgs,
  checkNodeVersion,
  checkPython,
  loadServices,
  loadHostConfig,
  resolveDataAndOutputDirs,
} from "./preflight.js";
import { checkSchema, checkDataSanity } from "./healthcheck.js";
import { PerformanceDataExtractor } from "./extractor.js";

async function main() {
  console.log(`🚀 Starting Optimized Performance Data Extraction Pipeline...`);

  console.log(`\n🔍 執行環境事前點檢...`);
  checkNodeVersion();
  const pythonCmd = checkPython();

  const args = parseArgs();
  const { SourceManager } = await loadServices(args);
  const { hostId, hostConfig, configPath } = loadHostConfig(args.host, args);
  const library = args.lib || hostConfig.library || "QPFRDATA";
  const maxDays = args.maxDays ? parseInt(args.maxDays, 10) : (hostConfig.maxDays || 5);
  if (!args.date) {
    console.error("❌ 缺少必要參數！必須提供 --date (例如 --date=07/13) 以建立正確的目錄結構。");
    process.exit(1);
  }
  const dateStrSafe = args.date.replace(/\//g, "-");
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library, dateStrSafe);

  console.log(`📌 Host: ${hostConfig.host} (id: ${hostId})`);
  console.log(`📌 Library: ${library}`);
  console.log(`📌 Config: ${configPath}`);
  console.log(`📌 Data dir: ${dataDir}`);
  console.log(`📌 Output dir: ${outDir}`);

  const manager = SourceManager.getInstance();
  await manager.registerSource(hostId, {
    host: hostConfig.host,
    user: hostConfig.user,
    password: hostConfig.password,
    port: hostConfig.port || 8076,
    ignoreUnauthorized: true,
  });

  try {
    await checkSchema(manager, hostId, library, { force: args.forceSchemaCheck === "true" });

    // Extract data using the Deep Module
    const extractor = new PerformanceDataExtractor(manager, hostId, library);
    const { dates, times, dataByDate, peakJobsByDate, metricSamples } = await extractor.extractSpecificDate(args.date);

    console.log(``);
    const dataQualityWarnings = checkDataSanity(metricSamples);

    // Step 3: Write payload JSON
    const payload = {
      host: hostId,
      lib: library,
      dates: dates.reverse(), // Show in chronological order
      times,
      data: dataByDate,
      peakJobs: peakJobsByDate,
      dataQualityWarnings
    };

    const jsonPath = path.join(dataDir, `${hostId}_perf_all.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    console.log(`\n✔ Saved consolidated performance JSON payload to: ${jsonPath}`);

    // Step 4: Run generate_report.py (the reporter script itself travels with the skill)
    const hostUpper = hostId.toUpperCase();
    const libUpper = library.toUpperCase();
    const reporterScript = path.join(SKILL_ROOT, "scripts", "generate_report.py");

    console.log(`\n📊 Generating HTML Report...`);
    const outPath = path.join(outDir, `${hostUpper}_${libUpper}_Performance_Report.html`);
    const rcaFlag = args.rca === "true" ? " --rca" : "";
    const cmd = `${pythonCmd} "${reporterScript}" --input "${jsonPath}" --output "${outPath}" --host ${hostId} --lib ${library}${rcaFlag}`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { encoding: "utf8" });
    const generatedPaths = [outPath];

    console.log(`\n🎉 Success!`);
    generatedPaths.forEach(p => console.log(`📄 Report: ${p}`));

  } finally {
    await manager.shutdown();
  }
}

main().catch(e => {
  console.error(`❌ Pipeline failed:`, e.message);
  process.exit(1);
});
