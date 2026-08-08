import fs from "fs";
import path from "path";
import {
  resolveDataAndOutputDirs,
  runPreflight,
  loadServices,
} from "./core/preflight.js";
import { checkSchema, checkDataSanity } from "./extraction/healthcheck.js";
import { PerformanceDataExtractor, discoverLibrariesForDates } from "./extraction/extractor.js";
import { resolveLibraryAndJsonPath } from "./analysis/rcaUtils.js";
import { generateHtmlReport as generateReport } from "./reporting/generateReport.js";

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

// Shared by both the cache-hit and freshly-extracted paths so the HTML
// dashboard is always produced the same way regardless of where the JSON
// payload came from.
function generateHtmlReport({ jsonPath, outDir, hostId, library, label, rcaFlag }) {
  const libUpper = library.toUpperCase();
  const outPath = path.join(outDir, `${libUpper}_perf_${label}.html`);

  console.log(`\n📊 Generating HTML Report (JS)...`);
  generateReport({
    input: jsonPath,
    output: outPath,
    host: hostId,
    lib: library,
    rca: rcaFlag === " --rca" || rcaFlag === true
  });
  return outPath;
}

function labelFor(dates) {
  return dates.length === 1
    ? dates[0].replace(/\//g, "")
    : `${dates[0].replace(/\//g, "")}_to_${dates[dates.length - 1].replace(/\//g, "")}`;
}

async function main() {
  console.log(`🚀 Starting Optimized Performance Data Extraction Pipeline...`);

  console.log(`\n🔍 執行環境事前點檢...`);
  // Local-first: resolve host config only (no Python check, no live DB
  // connection yet) so a request that's already fully cached locally never
  // needs either.
  const { args, hostId, hostConfig, configPath } =
    await runPreflight({ requireServices: false, requirePython: false });

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
  const dateSpec = hasSingleDate ? { date: args.date } : { dateFrom: args.dateFrom, dateTo: args.dateTo };
  const libraryWasExplicit = !!args.lib;
  const rcaFlag = args.rca === "true" ? " --rca" : "";

  console.log(`📌 Host: ${hostConfig.host} (id: ${hostId})`);
  console.log(`📌 Config: ${configPath}`);

  // --- Local cache check: skip the live host entirely if a perf_*.json
  // already covers every requested date, in this library or (when --lib
  // wasn't pinned) a sibling library under data/<host>/. Use
  // --forceExtract=true to always re-query the host regardless of cache.
  const cacheHit = args.forceExtract === "true"
    ? null
    : resolveLibraryAndJsonPath(hostConfig, hostId, args, dateSpec);

  if (cacheHit && cacheHit.jsonPath) {
    const { library, outDir, jsonPath, autoSwitched } = cacheHit;
    if (autoSwitched) {
      console.log(`⚠️ 主機預設 Library 沒有涵蓋 ${targetDates.join(", ")} 的本地快取，自動改用 Library "${library}"（已在本機找到相符資料）。`);
    }
    console.log(`✔ 本地已有涵蓋 ${targetDates.join(", ")} 的快取資料，略過連線擷取：${jsonPath}`);
    console.log(`📌 Library: ${library}`);
    console.log(`📌 Output dir: ${outDir}`);

    const cachedPayload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const outPath = generateHtmlReport({
      jsonPath, outDir, hostId, library, rcaFlag,
      label: labelFor(cachedPayload.dates),
    });

    console.log(`\n🎉 Success! (本地快取，未連線主機)`);
    console.log(`📄 Report: ${outPath}`);
    return;
  }

  console.log(
    args.forceExtract === "true"
      ? `ℹ️ --forceExtract=true，略過本地快取檢查，直接連線主機擷取...`
      : `ℹ️ 本地沒有涵蓋 ${targetDates.join(", ")} 的快取資料，改連線主機擷取...`
  );

  // --- Live extraction path ---
  const { SourceManager } = await loadServices(args);
  let library = args.lib || hostConfig.library || "QPFRDATA";
  let { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library);

  console.log(`📌 Library: ${library}`);
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
    let extractor = new PerformanceDataExtractor(manager, hostId, library);
    let { dates, times, dataByDate, peakJobsByDate, diskArms, metricSamples } = await extractor.extractDates(targetDates);

    // The configured default library can be wrong for the requested dates (a
    // host's Collection Services data can live in more than one *MGTCOL
    // library). Auto-discover and retry once instead of making the caller
    // guess a --lib value by trial and error — only when --lib wasn't pinned
    // explicitly, since an explicit --lib is a deliberate request that should
    // fail loudly if empty, not get silently overridden.
    if (dates.length === 0 && !libraryWasExplicit) {
      console.log(`\n⚠️ Library "${library}"（主機預設值）找不到符合 ${targetDates.join(", ")} 的資料，自動掃描主機上其他含效能資料的 library...`);
      const candidates = await discoverLibrariesForDates(manager, hostId, targetDates);
      const best = candidates.find((c) => c.library !== library);

      if (best) {
        console.log(`✔ 自動偵測到 Library "${best.library}" 有 ${best.matchCount} 個相符 partition，改用此 library 重新擷取...`);
        library = best.library;
        ({ dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library));
        console.log(`📌 Library (自動切換後): ${library}`);
        console.log(`📌 Data dir: ${dataDir}`);
        console.log(`📌 Output dir: ${outDir}`);

        await checkSchema(manager, hostId, library, { force: args.forceSchemaCheck === "true" });
        extractor = new PerformanceDataExtractor(manager, hostId, library);
        ({ dates, times, dataByDate, peakJobsByDate, diskArms, metricSamples } = await extractor.extractDates(targetDates));
      }
    }

    if (dates.length === 0) {
      throw new Error(`在 Library "${library}" 中找不到任何符合 ${targetDates.join(", ")} 的 partition，未產生任何檔案。`);
    }

    console.log(``);
    const dataQualityWarnings = checkDataSanity(metricSamples);

    const chronologicalDates = dates.reverse(); // Show in chronological order

    // Filename label is derived from the dates actually found in the data
    // (not from the requested --date/--dateFrom/--dateTo), so a file's name
    // always accurately reflects its content even if the library has gaps.
    const label = labelFor(chronologicalDates);

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

    // Step 4: Run generateReport.js (the reporter script itself travels with the skill)
    const outPath = generateHtmlReport({ jsonPath, outDir, hostId, library, label, rcaFlag });

    console.log(`\n🎉 Success!`);
    console.log(`📄 Report: ${outPath}`);

  } finally {
    await manager.shutdown();
  }
}

main().catch(e => {
  console.error(`❌ Pipeline failed:`, e.message);
  process.exit(1);
});
