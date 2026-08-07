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

// Expands an inclusive --dateFrom..--dateTo window into "MM/DD" strings,
// using the same non-leap-year model julianToDateStr (extractor.js) assumes,
// so a Feb 29 never appears on either side of the date matching.
function enumerateDateRange(fromStr, toStr) {
  const parse = (s) => {
    const [m, d] = s.split("/").map(Number);
    return new Date(2001, m - 1, d);
  };
  const from = parse(fromStr);
  const to = parse(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error(`無效的日期格式: --dateFrom=${fromStr} --dateTo=${toStr} (需為 MM/DD)`);
  }
  if (from > to) {
    throw new Error(`--dateFrom (${fromStr}) 必須早於或等於 --dateTo (${toStr})`);
  }
  const dates = [];
  for (const d = from; d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

async function main() {
  console.log(`🚀 Starting Optimized Performance Data Extraction Pipeline...`);

  console.log(`\n🔍 執行環境事前點檢...`);
  checkNodeVersion();
  const pythonCmd = checkPython();

  const args = parseArgs();
  const { SourceManager } = await loadServices(args);
  const { hostId, hostConfig, configPath } = loadHostConfig(args.host, args);
  const library = args.lib || hostConfig.library || "QPFRDATA";

  const hasSingleDate = !!args.date;
  const hasRange = !!args.dateFrom || !!args.dateTo;
  if (!hasSingleDate && !hasRange) {
    console.error("❌ 缺少必要參數！必須提供 --date=MM/DD (單日) 或 --dateFrom=MM/DD --dateTo=MM/DD (區間)。");
    process.exit(1);
  }
  if (hasSingleDate && hasRange) {
    console.error("❌ 參數衝突：--date 不可與 --dateFrom/--dateTo 同時使用，請擇一。");
    process.exit(1);
  }
  if (hasRange && (!args.dateFrom || !args.dateTo)) {
    console.error("❌ --dateFrom 與 --dateTo 必須同時提供才能指定區間。");
    process.exit(1);
  }

  const targetDates = hasSingleDate ? [args.date] : enumerateDateRange(args.dateFrom, args.dateTo);

  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library);

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
    const { dates, times, dataByDate, peakJobsByDate, diskArms, metricSamples } = await extractor.extractDates(targetDates);

    if (dates.length === 0) {
      throw new Error(`在 Library "${library}" 中找不到任何符合 ${targetDates.join(", ")} 的 partition，未產生任何檔案。`);
    }

    console.log(``);
    const dataQualityWarnings = checkDataSanity(metricSamples);

    const chronologicalDates = dates.reverse(); // Show in chronological order

    // Filename label is derived from the dates actually found in the data
    // (not from the requested --date/--dateFrom/--dateTo), so a file's name
    // always accurately reflects its content even if the library has gaps.
    const label = chronologicalDates.length === 1
      ? chronologicalDates[0].replace(/\//g, "")
      : `${chronologicalDates[0].replace(/\//g, "")}_to_${chronologicalDates[chronologicalDates.length - 1].replace(/\//g, "")}`;

    // Step 3: Write payload JSON
    const payload = {
      host: hostId,
      lib: library,
      dates: chronologicalDates,
      times,
      data: dataByDate,
      peakJobs: peakJobsByDate,
      diskArms,
      dataQualityWarnings
    };

    const jsonPath = path.join(dataDir, `perf_${label}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    console.log(`\n✔ Saved consolidated performance JSON payload to: ${jsonPath}`);

    // Step 4: Run generate_report.py (the reporter script itself travels with the skill)
    const libUpper = library.toUpperCase();
    const reporterScript = path.join(SKILL_ROOT, "scripts", "generate_report.py");

    console.log(`\n📊 Generating HTML Report...`);
    const outPath = path.join(outDir, `${libUpper}_perf_${label}.html`);
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
