import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs, loadHostConfig, resolveDataAndOutputDirs } from "./preflight.js";
import { resolveJsonPath, resolveContextDir, summarizeHits } from "./rcaUtils.js";

// Only the top N disk units get full detail; a busy system can have dozens of
// units each showing up across many intervals, same rationale as
// anomaly_scan.js's DETAIL_TOP_N.
const DETAIL_TOP_N = 15;

/**
 * Scan every interval's top-5-busiest-disk-unit list for `date` and aggregate
 * per unit (keyed by `drn`, device resource name — the actual unique per-disk
 * identity; `arm_id` is NOT unique, see queries.js's diskArmQuery comment):
 * how often it was the #1 busiest unit that interval (top1Count, mirrors
 * anomaly_scan's totalHits-style "sustained impact" signal) and its cumulative
 * service+wait time across all appearances (totalServiceWait, a magnitude
 * tiebreaker). Ranking is frequency-of-topping first, cumulative service+wait
 * time second — NOT raw I/O count and NOT busy% alone, per field_reference.md's
 * explicit warning that busy% can look low even under huge I/O volume when SAN
 * cache (DSDCFW) absorbs the load (the MIMIX CMPFILDTA case: 87M I/O/interval,
 * only 4–12% busy). Every hot unit's I/O count, busy%, and cache-fast-write
 * count are surfaced side by side rather than picking one as "the" signal.
 */
function scanDiskHotspots(data, date) {
  const diskArmsByTime = (data.diskArms && data.diskArms[date]) || {};
  const byDrn = {}; // drn -> { arm_id, hits: [...] }

  for (const time of Object.keys(diskArmsByTime)) {
    const units = diskArmsByTime[time]; // pre-sorted busy_pct desc (top 5)
    units.forEach((unit, idx) => {
      if (!byDrn[unit.drn]) byDrn[unit.drn] = { arm_id: unit.arm_id, hits: [] };
      byDrn[unit.drn].hits.push({ ...unit, time, isTop1: idx === 0 });
    });
  }

  const ranking = Object.entries(byDrn).map(([drn, info]) => {
    const maxBusyPct = Math.max(...info.hits.map(h => h.busy_pct));
    // Tag each hit with the {metric,val1,isDayPeak} shape summarizeHits() expects,
    // while keeping the original disk-specific fields (reads/writes/srvt/wait/cache)
    // intact for detailed rendering — reusing summarizeHits() rather than writing
    // a disk-specific summarizer.
    const hits = info.hits
      .map(h => ({ ...h, metric: "Busy", val1: h.busy_pct, isDayPeak: h.busy_pct === maxBusyPct }))
      .sort((a, b) => (a.time < b.time ? -1 : 1));

    const top1Count = hits.filter(h => h.isTop1).length;
    const totalServiceWait = Number(hits.reduce((sum, h) => sum + h.srvt_ms + h.wait_ms, 0).toFixed(2));
    const totalReads = hits.reduce((sum, h) => sum + h.reads, 0);
    const totalWrites = hits.reduce((sum, h) => sum + h.writes, 0);
    const totalCacheFastWrites = hits.reduce((sum, h) => sum + h.cache_fast_writes, 0);

    return { drn, arm_id: info.arm_id, totalHits: hits.length, top1Count, totalServiceWait, maxBusyPct, totalReads, totalWrites, totalCacheFastWrites, hits };
  });

  ranking.sort((a, b) => (b.top1Count - a.top1Count) || (b.totalServiceWait - a.totalServiceWait));

  return ranking;
}

function buildMarkdown(ranking, args, hostConfig) {
  let md = `# 🔍 Disk Hot-Spot Scan Context\n\n`;
  md += `**Host**: ${hostConfig.host}\n`;
  md += `**Date**: ${args.date}\n\n`;
  md += `> 系統提示：此為磁碟熱點掃描腳本產出的上下文數據，排序依據為：(1) 當日成為最忙磁碟單元（Top-5 中排名第一）的次數、(2) 當日累計 Service+Wait 時間。以 \`DRN\`（Device Resource Name）作為磁碟單元的唯一識別碼——\`ARM\` 編號在本環境**不是**唯一識別碼（同一個 ARM 編號可能對應多顆不同的實體磁碟，屬於同一個 RAID array/rank），僅列出供參考分組用。務必注意：busy% 在 SAN Cache（DSDCFW）大量吸收 I/O 時可能偏低，即使 I/O 量很大也可能顯示低使用率（例如單 interval 8,700 萬次 I/O 但磁碟使用率僅 4–12% 的實測案例），因此下方同時列出 I/O 次數、busy%、Cache Fast Writes，不可只看單一欄位判斷。請 AI Agent 直接依據此上下文撰寫分析，不需再自行解析原始 JSON。僅前 ${DETAIL_TOP_N} 名附完整明細，其餘視為長尾、影響力低，僅列於總表。\n\n`;

  if (ranking.length === 0) {
    md += `*(此日期無 diskArms 資料——可能是用舊版 pipeline 擷取、尚未包含逐磁碟明細，請重新執行 npm run extract 擷取此日期。)*\n`;
    return md;
  }

  md += `### 排行總表 (依影響力排序，共 ${ranking.length} 顆磁碟單元)\n\n`;
  md += `| 排名 | DRN | ARM（分組參考，非唯一） | 當日最忙(#1)次數 | 累計 Service+Wait (ms) | 當日最高 Busy% | 累計 Reads | 累計 Writes | 累計 Cache Fast Writes |\n`;
  md += `| ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  ranking.forEach((r, i) => {
    md += `| ${i + 1} | ${r.drn} | ${r.arm_id} | ${r.top1Count} | ${r.totalServiceWait} | ${r.maxBusyPct}% | ${r.totalReads} | ${r.totalWrites} | ${r.totalCacheFastWrites} |\n`;
  });
  md += `\n`;

  const top = ranking.slice(0, DETAIL_TOP_N);
  md += `### Top ${top.length} 候選磁碟單元明細\n\n`;
  top.forEach((r, i) => {
    md += `**#${i + 1} DRN ${r.drn}（ARM ${r.arm_id}）**\n\n`;
    const summary = summarizeHits(r.hits);
    if (summary.detailed) {
      md += `| 時間 | Busy% | Reads | Writes | Service (ms) | Wait (ms) | Cache Fast Writes | 是否當日最忙 |\n`;
      md += `| :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |\n`;
      for (const h of summary.hits) {
        md += `| ${h.time} | ${h.busy_pct}% | ${h.reads} | ${h.writes} | ${h.srvt_ms} | ${h.wait_ms} | ${h.cache_fast_writes} | ${h.isTop1 ? "✅ 是" : "否"} |\n`;
      }
    } else {
      md += `*(共 ${r.hits.length} 筆，樣本數過多，改以統計摘要呈現；僅列出當日 Busy% 最高的時刻。)*\n\n`;
      md += `| 樣本數 | 時間範圍 | Busy% 最小值 | Busy% 最大值 | Busy% 平均值 |\n`;
      md += `| ---: | :--- | ---: | ---: | ---: |\n`;
      const s = summary.metricSummaries[0];
      md += `| ${s.count} | ${s.firstTime} ~ ${s.lastTime} | ${s.minVal1}% | ${s.maxVal1}% | ${s.avgVal1}% |\n\n`;
      if (summary.dayPeakHits.length > 0) {
        md += `**當日 Busy% 最高的時刻**（含 I/O 明細）：\n\n`;
        md += `| 時間 | Busy% | Reads | Writes | Service (ms) | Wait (ms) | Cache Fast Writes |\n`;
        md += `| :--- | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
        for (const h of summary.dayPeakHits) {
          md += `| ${h.time} | ${h.busy_pct}% | ${h.reads} | ${h.writes} | ${h.srvt_ms} | ${h.wait_ms} | ${h.cache_fast_writes} |\n`;
        }
      }
    }
    md += `\n`;
  });

  if (args.debug) {
    md += `**Raw Data (--debug)**:\n`;
    md += `\`\`\`json\n${JSON.stringify(top, null, 2)}\n\`\`\`\n`;
  }

  return md;
}

async function main() {
  console.log("🔍 Starting Disk Hot-Spot Scan...");
  const args = parseArgs();

  if (!args.host || !args.date) {
    console.error("❌ 缺少必要參數！必須提供 --host, --date");
    console.error("範例: node scripts/disk_hotspot_scan.js --host=clark75 --date=07/14");
    console.error("加上 --debug=true 會在檔案末端附上原始 JSON（預設不附，減少輸出大小）。");
    process.exit(1);
  }

  const { hostId, hostConfig } = loadHostConfig(args.host, args);
  const library = args.lib || hostConfig.library || "QPFRDATA";
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library);
  const contextDir = resolveContextDir(outDir);

  const jsonPath = resolveJsonPath(dataDir, args.date);
  if (!jsonPath) {
    console.error(`❌ 在 ${dataDir} 找不到包含 ${args.date} 的效能資料 JSON 檔。請先執行擷取 Pipeline。`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const ranking = scanDiskHotspots(data, args.date);
  const markdown = buildMarkdown(ranking, args, hostConfig);

  const label = args.date.replace(/\//g, "");
  const contextPath = path.join(contextDir, `disk_hotspot_scan_${label}.md`);
  fs.writeFileSync(contextPath, markdown, "utf-8");

  console.log(`✅ Disk Hot-Spot Scan Context 已產出至: ${contextPath}`);
  if (ranking.length > 0) {
    console.log(`💡 最熱門磁碟單元: DRN ${ranking[0].drn}（ARM ${ranking[0].arm_id}，當日最忙 ${ranking[0].top1Count} 次，累計 Service+Wait ${ranking[0].totalServiceWait}ms）`);
  }
  console.log(`💡 AI Agent，請讀取此檔案撰寫磁碟熱點分析報告，寫入 ${path.join(outDir, `disk_hotspot_report_${label}.md`)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error("發生錯誤:", err);
    process.exit(1);
  });
}
