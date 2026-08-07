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
  resolveOutputDirs,
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
  const outputDirs = resolveOutputDirs(hostConfig, hostId);

  console.log(`📌 Host: ${hostConfig.host} (id: ${hostId})`);
  console.log(`📌 Library: ${library}`);
  console.log(`📌 Config: ${configPath}`);
  console.log(`📌 Output dirs: ${outputDirs.join(", ")}`);

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
    const { dates, times, dataByDate, peakJobsByDate, metricSamples } = await extractor.extractRecentDays(maxDays);

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

    const jsonPath = path.join(outputDirs[0], `${hostId}_perf_all.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    console.log(`\n✔ Saved consolidated performance JSON payload to: ${jsonPath}`);

    // Step 4: Run generate_report.py (the reporter script itself travels with the skill)
    const hostUpper = hostId.toUpperCase();
    const libUpper = library.toUpperCase();
    const reporterScript = path.join(SKILL_ROOT, "scripts", "generate_report.py");

    console.log(`\n📊 Generating HTML Report...`);
    const generatedPaths = [];
    for (const dir of outputDirs) {
      const outPath = path.join(dir, `${hostUpper}_${libUpper}_Performance_Report.html`);
      const rcaFlag = args.rca === "true" ? " --rca" : "";
      const cmd = `${pythonCmd} "${reporterScript}" --input "${jsonPath}" --output "${outPath}" --host ${hostId} --lib ${library}${rcaFlag}`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { encoding: "utf8" });
      generatedPaths.push(outPath);
    }

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
