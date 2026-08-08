import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runPreflight } from "./core/preflight.js";
import { METRIC_LABELS, resolveContextDir, resolveLibraryAndJsonPath, summarizeHits } from "./analysis/rcaUtils.js";

// Transaction Count is excluded from anomaly scoring: a high transaction volume
// alone is business load, not a resource anomaly (see TB7277206B precedent —
// high Count with zero CPU/Disk/Fault footprint is healthy, not abnormal).
const IMPACT_METRICS = ["Rsp", "Tot", "Int", "Bch", "Dsk", "Usr", "Szwt"];

/**
 * Scan every interval of `date` and, per impact metric, take the #1 ranked job
 * (peakJobs entries are pre-sorted descending by val1 — since peakJobs only keeps
 * rank<=10 jobs per interval, index 0 is genuinely that interval's highest job-level
 * value for the metric). Aggregate how often each job tops a chart and whether it
 * ever posted that metric's single highest value anywhere in the day.
 *
 * Note: val1's unit differs per metric (CPU_MS, seconds, IO count, faults/sec) and
 * does NOT share a scale with the system-wide series in data.data[date][metric]
 * (e.g. Tot there is CPU%, not CPU_MS) — comparing job val1 against that series would
 * produce meaningless percentages, so all comparisons here stay job-level-to-job-level
 * within the same metric.
 */
export function scanAnomalies(data, date) {
  const peakJobs = data.peakJobs[date] || {};

  const byJob = {}; // job_name -> { user_name, hits: [{metric,time,val1,val2}] }
  const dayMaxByMetric = {}; // metric -> highest val1 seen at any interval

  for (const metric of IMPACT_METRICS) {
    if (!peakJobs[metric]) continue;

    for (const time of Object.keys(peakJobs[metric])) {
      const jobs = peakJobs[metric][time];
      if (!jobs || jobs.length === 0) continue;
      const top = jobs[0]; // highest val1 at this interval for this metric

      if (dayMaxByMetric[metric] == null || top.val1 > dayMaxByMetric[metric]) {
        dayMaxByMetric[metric] = top.val1;
      }

      if (!byJob[top.job_name]) byJob[top.job_name] = { user_name: top.user_name, hits: [] };
      byJob[top.job_name].hits.push({ metric, time, val1: top.val1, val2: top.val2 });
    }
  }

  const ranking = Object.entries(byJob).map(([job_name, info]) => {
    const hits = info.hits.map(h => ({ ...h, isDayPeak: h.val1 === dayMaxByMetric[h.metric] }));
    const metricsHit = [...new Set(hits.map(h => h.metric))];
    const dayPeakHits = hits.filter(h => h.isDayPeak).length;
    return {
      job_name,
      user_name: info.user_name,
      totalHits: hits.length,
      metricsHit,
      dayPeakHits,
      hits: hits.sort((a, b) => (a.time < b.time ? -1 : 1)),
    };
  });

  // Sustained chart-topping (totalHits) outweighs a handful of single-moment spikes
  // (dayPeakHits) when judging whole-day impact — a job parked at #1 for 166 of ~576
  // interval-slots is a bigger story than one that peaked hardest 4 times.
  ranking.sort((a, b) =>
    (b.totalHits - a.totalHits) ||
    (b.dayPeakHits - a.dayPeakHits)
  );

  return { ranking, dayMaxByMetric };
}

// Only the top N candidates get full detail; with 96 intervals x 6 metrics a day
// can easily surface 100+ distinct "rank #1 at some moment" jobs, and dumping all
// of them would blow past a readable context size for no analytical benefit — the
// long tail is, by construction, low-impact.
const DETAIL_TOP_N = 15;

function buildMarkdown(ranking, dayMaxByMetric, args, hostConfig) {
  let md = `# 🔍 Anomaly Scan Context\n\n`;
  md += `**Host**: ${hostConfig.host}\n`;
  md += `**Date**: ${args.date}\n`;
  md += `**Scope**: 全天所有時段，針對 ${IMPACT_METRICS.map(m => METRIC_LABELS[m]).join("、")} 六大資源維度，each 時段各維度的排行榜第一名（消耗最高的 Job）\n\n`;
  md += `> 系統提示：此為異常 Job 掃描腳本產出的上下文數據，排序依據為：(1) 登上排行榜第一名的總次數、(2) 達成當日該維度絕對峰值（該維度全天所有 Job 中的最高單一數值）的次數。val1 單位依維度而異（CPU_MS／秒／IO 次數／faults 數），僅可跨時段比較同一維度，不可跨維度比較。請 AI Agent 直接依據此上下文列出異常 Job 清單並撰寫分析，不需再自行解析原始 JSON。僅前 ${DETAIL_TOP_N} 名附完整明細，其餘視為長尾、影響力低，僅列於總表。\n\n`;

  if (ranking.length === 0) {
    md += `*(全天未偵測到任何 Job 登上 ${IMPACT_METRICS.join("/")} 排行榜第一名，系統資源分布平均，無明顯異常 Job。)*\n`;
    return md;
  }

  md += `### 各維度全天最高單一數值 (day max, 供對照)\n\n`;
  md += `| 維度 | 全天最高值 (val1) |\n`;
  md += `| :--- | ---: |\n`;
  for (const metric of IMPACT_METRICS) {
    if (dayMaxByMetric[metric] != null) {
      md += `| ${METRIC_LABELS[metric] || metric} | ${dayMaxByMetric[metric]} |\n`;
    }
  }
  md += `\n`;

  md += `### 排行總表 (依影響力排序，共 ${ranking.length} 個 Job 曾登頂)\n\n`;
  md += `| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |\n`;
  md += `| ---: | :--- | :--- | :--- | ---: | ---: |\n`;
  ranking.forEach((r, i) => {
    md += `| ${i + 1} | ${r.job_name} | ${r.user_name} | ${r.metricsHit.map(m => METRIC_LABELS[m] || m).join("、")} | ${r.totalHits} | ${r.dayPeakHits} |\n`;
  });
  md += `\n`;

  const top = ranking.slice(0, DETAIL_TOP_N);
  md += `### Top ${top.length} 候選 Job 明細\n\n`;
  top.forEach((r, i) => {
    md += `**#${i + 1} ${r.job_name}**\n\n`;
    const summary = summarizeHits(r.hits);
    if (summary.detailed) {
      md += `| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |\n`;
      md += `| :--- | :--- | ---: | :--- |\n`;
      for (const h of summary.hits) {
        const peakFlag = h.isDayPeak ? `✅ 是（全天最高峰，${dayMaxByMetric[h.metric]}）` : "否";
        md += `| ${h.time} | ${METRIC_LABELS[h.metric] || h.metric} | ${h.val1} | ${peakFlag} |\n`;
      }
    } else {
      md += `*(共 ${r.hits.length} 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*\n\n`;
      md += `| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |\n`;
      md += `| :--- | ---: | :--- | ---: | ---: | ---: |\n`;
      for (const s of summary.metricSummaries) {
        md += `| ${METRIC_LABELS[s.metric] || s.metric} | ${s.count} | ${s.firstTime} ~ ${s.lastTime} | ${s.minVal1} | ${s.maxVal1} | ${s.avgVal1} |\n`;
      }
      if (summary.dayPeakHits.length > 0) {
        md += `\n**達成當日絕對峰值的時刻**：\n\n`;
        md += `| 時間 | 維度 | 數值 (val1) |\n`;
        md += `| :--- | :--- | ---: |\n`;
        for (const h of summary.dayPeakHits) {
          md += `| ${h.time} | ${METRIC_LABELS[h.metric] || h.metric} | ${h.val1} |\n`;
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
  console.log("🔍 Starting Anomaly Scan...");
  const { args, hostId, hostConfig } = await runPreflight({ requireServices: false });

  if (!args.host || !args.date) {
    console.error("❌ 缺少必要參數！必須提供 --host, --date");
    console.error("範例: node scripts/anomaly_scan.js --host=clark75 --date=07/14");
    console.error("加上 --debug=true 會在檔案末端附上原始 JSON（預設不附，減少輸出大小）。");
    process.exit(1);
  }


  const { library, outDir, jsonPath, triedLibraries, autoSwitched } =
    resolveLibraryAndJsonPath(hostConfig, hostId, args, { date: args.date });
  const contextDir = resolveContextDir(outDir);

  if (autoSwitched) {
    console.log(`⚠️ 主機預設 Library 找不到 ${args.date} 的快取資料，自動改用 Library "${library}"（已在本機找到相符資料）。`);
  }
  if (!jsonPath) {
    console.error(`❌ 在 ${triedLibraries.map((l) => `data/${hostConfig.host}/${l}/`).join("、")} 都找不到包含 ${args.date} 的效能資料 JSON 檔。請先執行擷取 Pipeline。`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const { ranking, dayMaxByMetric } = scanAnomalies(data, args.date);
  const markdown = buildMarkdown(ranking, dayMaxByMetric, args, hostConfig);

  const label = args.date.replace(/\//g, "");
  const contextPath = path.join(contextDir, `anomaly_scan_${label}.md`);
  fs.writeFileSync(contextPath, markdown, "utf-8");

  console.log(`✅ Anomaly Scan Context 已產出至: ${contextPath}`);
  if (ranking.length > 0) {
    console.log(`💡 影響最大的 Job: ${ranking[0].job_name}（登頂 ${ranking[0].totalHits} 次，涵蓋 ${ranking[0].metricsHit.join("/")}）`);
    console.log(`💡 AI Agent，請讀取此檔案列出異常 Job 清單，並針對排名第一的 Job 執行 npm run rca -- --host=${args.host} --job=${ranking[0].job_name} --date=${args.date} 產出全天 RCA 報告。`);
  } else {
    console.log("💡 全天無異常 Job，AI Agent 可直接回報系統運作正常。");
  }
}

// Only run the CLI when this file is executed directly (`node anomaly_scan.js`
// or `npm run anomaly`) — not when other scripts (e.g. daily_digest.js) import
// scanAnomalies() as a library function.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error("發生錯誤:", err);
    process.exit(1);
  });
}
