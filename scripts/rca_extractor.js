import fs from "fs";
import path from "path";
import { resolveDataAndOutputDirs, runPreflight } from "./preflight.js";
import {
  METRIC_LABELS, jobMatches, resolveJsonPath, resolveContextDir,
  SYSTEM_COMPARABLE_METRICS, computeJobLevelDayMax, summarizeHits,
} from "./rcaUtils.js";

/**
 * Single time-slot mode: dump the target job's ranked metrics at one specific interval.
 */
function buildSingleTimeContext(data, args, hostConfig) {
  const peakJobs = data.peakJobs;
  const jobsAtTime = [];
  const metricsData = {};
  for (const metric of Object.keys(peakJobs[args.date])) {
    if (peakJobs[args.date][metric][args.time]) {
      const jobs = peakJobs[args.date][metric][args.time];
      jobsAtTime.push(...jobs);

      const target = jobs.find(j => jobMatches(j.job_name, args.job));
      if (target) {
        metricsData[metric] = { val1: target.val1, val2: target.val2 };
      }
    }
  }

  if (Object.keys(metricsData).length === 0) {
    console.error(`❌ 在 ${args.date} ${args.time} 找不到指定的 Job: ${args.job}`);
    process.exit(1);
  }

  const targetJob = jobsAtTime.find(j => jobMatches(j.job_name, args.job));

  let markdown = `# 🔍 RCA Data Context\n\n`;
  markdown += `**Host**: ${hostConfig.host}\n`;
  markdown += `**Date**: ${args.date}\n`;
  markdown += `**Time**: ${args.time}\n`;
  markdown += `**Job**: ${targetJob.job_name}\n`;
  markdown += `**User**: ${targetJob.user_name}\n\n`;

  markdown += `### Job 負載排行與資源消耗\n`;
  markdown += `| 維度 | 數值 (val1) | 次要值 (val2) |\n`;
  markdown += `| :--- | ---: | ---: |\n`;
  for (const [metric, m] of Object.entries(metricsData)) {
    markdown += `| ${METRIC_LABELS[metric] || metric} | ${m.val1} | ${m.val2} |\n`;
  }
  markdown += `\n*(Note: In a live environment, OS level diagnostics and Pool analysis from QAPMJOBOS would be appended here.)*\n`;

  if (args.debug) {
    markdown += `\n**Raw Data (--debug)**:\n`;
    markdown += `\`\`\`json\n${JSON.stringify({ job_info: targetJob, metrics: metricsData }, null, 2)}\n\`\`\`\n`;
  }

  return markdown;
}

function renderHitsSection(title, hits, { withSystemTotal, withPeakFlag = true }) {
  let md = `### ${title}\n`;
  if (hits.length === 0) {
    md += `*(無資料)*\n\n`;
    return md;
  }

  const summary = summarizeHits(hits);

  if (summary.detailed) {
    md += `| 時間 | 維度 | 數值 (val1) |` + (withSystemTotal ? ` 系統當時段總量 | 佔比 |` : ``) + (withPeakFlag ? ` 是否為當日該維度最高峰 |` : ``) + `\n`;
    md += `| :--- | :--- | ---: |` + (withSystemTotal ? ` ---: | ---: |` : ``) + (withPeakFlag ? ` :--- |` : ``) + `\n`;
    for (const h of summary.hits) {
      const label = METRIC_LABELS[h.metric] || h.metric;
      const peakFlag = h.isDayPeak
        ? "✅ 是（全天最高峰）"
        : (h.dayPeakTime ? `否（該維度峰值在 ${h.dayPeakTime}，為 ${h.dayPeakVal}）` : "N/A");
      let row = `| ${h.time} | ${label} | ${h.val1} |`;
      if (withSystemTotal) {
        const comparable = SYSTEM_COMPARABLE_METRICS.has(h.metric);
        const sysTotal = comparable ? (h.systemTotal ?? "N/A") : "N/A（單位不同不可比）";
        const pct = comparable ? (h.pct != null ? `${h.pct}%` : "N/A") : "N/A（單位不同不可比）";
        row += ` ${sysTotal} | ${pct} |`;
      }
      if (withPeakFlag) row += ` ${peakFlag} |`;
      md += row + `\n`;
    }
    md += `\n`;
    return md;
  }

  md += `*(共 ${hits.length} 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*\n\n`;
  md += `| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |\n`;
  md += `| :--- | ---: | :--- | ---: | ---: | ---: |\n`;
  for (const s of summary.metricSummaries) {
    md += `| ${METRIC_LABELS[s.metric] || s.metric} | ${s.count} | ${s.firstTime} ~ ${s.lastTime} | ${s.minVal1} | ${s.maxVal1} | ${s.avgVal1} |\n`;
  }
  md += `\n`;

  if (withPeakFlag && summary.dayPeakHits.length > 0) {
    md += `**達成當日絕對峰值的時刻**：\n\n`;
    md += `| 時間 | 維度 | 數值 (val1) |\n`;
    md += `| :--- | :--- | ---: |\n`;
    for (const h of summary.dayPeakHits) {
      md += `| ${h.time} | ${METRIC_LABELS[h.metric] || h.metric} | ${h.val1} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Full-day mode (no --time given): scan every metric/interval on the date for the
 * target job, plus any sibling job-number instances of the same program+user, and
 * pre-compute day-peak flags so the AI only has to read the resulting markdown
 * instead of re-deriving all of this from raw JSON.
 */
function buildFullDayContext(data, args, hostConfig) {
  const date = args.date;
  const peakJobs = data.peakJobs[date];
  const times = data.times || [];
  const seriesByMetric = data.data[date] || {};

  const jobParts = args.job.split("/");
  const siblingPrefix = jobParts.length >= 2 ? `${jobParts[0]}/${jobParts[1]}/` : null;

  const exactHits = [];
  const siblingHits = {};

  for (const metric of Object.keys(peakJobs)) {
    for (const time of Object.keys(peakJobs[metric])) {
      for (const j of peakJobs[metric][time]) {
        if (jobMatches(j.job_name, args.job)) {
          exactHits.push({ metric, time, job_name: j.job_name, user_name: j.user_name, val1: j.val1, val2: j.val2 });
        } else if (siblingPrefix && j.job_name.startsWith(siblingPrefix)) {
          if (!siblingHits[j.job_name]) siblingHits[j.job_name] = [];
          siblingHits[j.job_name].push({ metric, time, val1: j.val1, val2: j.val2 });
        }
      }
    }
  }

  if (exactHits.length === 0 && Object.keys(siblingHits).length === 0) {
    console.error(`❌ 在 ${date} 全天找不到指定的 Job（或同 Program/User 的其他 Job Number）: ${args.job}`);
    process.exit(1);
  }

  // Enrich each hit with day-peak context. For Count/Rsp, job val1 and the system
  // series share units, so a system total + pct is meaningful. For the other
  // metrics (CPU_MS vs CPU%, IO_COUNT vs disk-busy%, raw FAULTS vs faults/sec),
  // the units don't match — compare this job's val1 against the day's max val1
  // among all ranked jobs for that metric instead (see rcaUtils.js).
  const jobLevelDayMaxCache = {};
  for (const hit of exactHits) {
    if (SYSTEM_COMPARABLE_METRICS.has(hit.metric)) {
      const series = seriesByMetric[hit.metric];
      const idx = times.indexOf(hit.time);
      const systemTotal = series && idx >= 0 ? series[idx] : null;
      hit.systemTotal = systemTotal;
      hit.pct = systemTotal ? Number(((hit.val1 / systemTotal) * 100).toFixed(1)) : null;
      if (series && series.length) {
        const maxVal = Math.max(...series);
        hit.isDayPeak = systemTotal === maxVal;
        hit.dayPeakTime = times[series.indexOf(maxVal)];
        hit.dayPeakVal = maxVal;
      }
    } else {
      if (!jobLevelDayMaxCache[hit.metric]) {
        jobLevelDayMaxCache[hit.metric] = computeJobLevelDayMax(peakJobs, hit.metric);
      }
      const { maxVal, maxTime } = jobLevelDayMaxCache[hit.metric];
      hit.systemTotal = null;
      hit.pct = null;
      hit.isDayPeak = maxVal != null && hit.val1 === maxVal;
      hit.dayPeakTime = maxTime;
      hit.dayPeakVal = maxVal;
    }
  }

  exactHits.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  const hitMetrics = new Set(exactHits.map(h => h.metric));
  const silentMetrics = Object.keys(METRIC_LABELS).filter(m => !hitMetrics.has(m) && seriesByMetric[m]);

  let markdown = `# 🔍 RCA Full-Day Data Context\n\n`;
  markdown += `**Host**: ${hostConfig.host}\n`;
  markdown += `**Date**: ${date}\n`;
  markdown += `**Mode**: 全天掃描（所有時段 x 所有排行榜維度）\n`;
  markdown += `**Job**: ${args.job}\n\n`;
  markdown += `> 系統提示：此為 RCA 收集腳本所產出的全天上下文數據，所有日峰值已預先計算完畢。請 AI Agent 直接依據此上下文撰寫診斷報告，不需再自行解析原始 JSON。僅 Transaction Count 與 Response Time 這兩個維度的「系統當時段總量/佔比」有意義（單位與 Job 層級一致）；其餘 CPU/Disk I/O/Page Faults 維度的系統時序為不同單位的彙總值（如 CPU% 而非 CPU_MS），故標示為不可比，該維度的「是否為當日該維度最高峰」改為與當日其他 Job 的同維度數值比較所得。\n\n`;

  markdown += renderHitsSection("1. 該 Job 全天上榜紀錄", exactHits, { withSystemTotal: true });

  markdown += `### 2. 全天未上榜維度\n`;
  markdown += silentMetrics.length
    ? `該 Job 全天在以下維度**皆未**進入 Top 15 排行榜（消耗低於門檻）：${silentMetrics.map(m => METRIC_LABELS[m] || m).join("、")}\n\n`
    : `*(所有維度皆有上榜紀錄，詳見上表。)*\n\n`;

  markdown += `### 3. 同 Program/User 的其他 Job Number（可能為前後不同執行期間）\n`;
  const siblingNames = Object.keys(siblingHits);
  if (siblingNames.length === 0) {
    markdown += `*(全天未偵測到同 Program/User 但不同 Job Number 的其他實例。)*\n\n`;
  } else {
    for (const name of siblingNames) {
      markdown += renderHitsSection(name, siblingHits[name], { withSystemTotal: false, withPeakFlag: false });
    }
  }

  if (args.debug) {
    markdown += `**Raw Data (--debug)**:\n`;
    markdown += `\`\`\`json\n${JSON.stringify({ exactHits, siblingHits }, null, 2)}\n\`\`\`\n`;
  }

  return markdown;
}

async function main() {
  console.log("🔍 Starting RCA Data Collector...");
  const { args, hostId, hostConfig } = await runPreflight({ requireServices: false });

  if (!args.host || !args.job || !args.date) {
    console.error("❌ 缺少必要參數！必須提供 --host, --job, --date（--time 可省略以進行全天掃描）");
    console.error("單一時段範例: node scripts/rca_extractor.js --host=clark75 --job=HN040130A/AP131091/730390 --date=07/13 --time=12:45");
    console.error("全天掃描範例: node scripts/rca_extractor.js --host=clark75 --job=TB7277206B/U180432/525840 --date=07/14");
    console.error("加上 --debug=true 會在檔案末端附上原始 JSON（預設不附，減少輸出大小）。");
    process.exit(1);
  }


  const library = args.lib || hostConfig.library || "QPFRDATA";
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library);
  const contextDir = resolveContextDir(outDir);

  const jsonPath = resolveJsonPath(dataDir, args.date);
  if (!jsonPath) {
    console.error(`❌ 在 ${dataDir} 找不到包含 ${args.date} 的效能資料 JSON 檔。請先執行擷取 Pipeline。`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const isFullDay = !args.time;

  const markdown = isFullDay
    ? buildFullDayContext(data, args, hostConfig)
    : buildSingleTimeContext(data, args, hostConfig);

  const safeJobName = args.job.replace(/[^a-zA-Z0-9_-]/g, "_");
  const suffix = isFullDay ? "_fullday" : "";
  const contextPath = path.join(contextDir, `rca_context_${safeJobName}${suffix}.md`);

  fs.writeFileSync(contextPath, markdown, "utf-8");
  console.log(`✅ RCA Context 已產出至: ${contextPath}`);
  console.log(`💡 AI Agent，請讀取此檔案並將最終報告寫入 ${path.join(outDir, `rca_report_${safeJobName}${suffix}.md`)}`);
}

main().catch(err => {
  console.error("發生錯誤:", err);
  process.exit(1);
});
