import fs from "fs";
import path from "path";
import { runPreflight, loadServices } from "./core/preflight.js";
import {
  METRIC_LABELS, jobMatches, resolveContextDir, resolveLibraryAndJsonPath,
  SYSTEM_COMPARABLE_METRICS, computeJobLevelDayMax, summarizeHits,
} from "./analysis/rcaUtils.js";
import { parseDsplog, findJobEvents, findNearbyConnects, describeEndCode } from "./analysis/dsplogParser.js";
import { fetchJobHistoryContext } from "./extraction/historyLogFetcher.js";

/**
 * Cross-references a target job against parsed QHST/DSPLOG events (see
 * dsplogParser.js) and renders a Deep-Module-style section: real requesting
 * user + client IP (QAPMJOBL only has the generic job-description user),
 * job lifecycle (connect/start -> end, duration, CPU seconds, end code),
 * sibling connections from the same user/IP around the same time (surfaces
 * paired interactive+ODBC/JDBC sessions), and the raw log lines as quotable
 * evidence — so the AI writing the final report doesn't have to grep the
 * log by hand.
 */
function buildDsplogSection(dsplogEvents, jobName, jobUser, jobNumber, heading = "### DSPLOG 交叉比對（登入/登出紀錄）") {
  if (!dsplogEvents) return "";

  let md = `${heading}\n\n`;

  const ownEvents = findJobEvents(dsplogEvents, jobName, jobUser, jobNumber);
  if (ownEvents.length === 0) {
    md += `*(在提供的 dsplog 中找不到 \`${jobName}/${jobUser}/${jobNumber}\` 的登入/登出紀錄——可能是 dsplog 涵蓋範圍不包含這個 Job，或這個 Job Number 已被系統回收重複使用。)*\n\n`;
    return md;
  }

  const connectEv = ownEvents.find((e) => e.kind === "connect");
  const startEv = ownEvents.find((e) => e.kind === "jobStart");
  const endEv = ownEvents.find((e) => e.kind === "jobEnd");

  if (connectEv) {
    md += `**真實使用者**：${connectEv.connect.requestUser}（來源 client：\`${connectEv.connect.clientIp}\`，連線時間 ${connectEv.date} ${connectEv.time}）\n\n`;
  } else if (startEv) {
    md += `**Job 啟動**：${startEv.date} ${startEv.time}（subsystem \`${startEv.jobStart.subsystem}\`）；dsplog 中無對應的用戶端連線紀錄（\`CPIAD09\`），可能是系統內部工作而非遠端連線。\n\n`;
  }

  if (endEv) {
    md += `**Job 生命週期**：結束於 ${endEv.date} ${endEv.time}，總計使用 ${endEv.jobEnd.secondsUsed} 秒 CPU，結束碼 \`${endEv.jobEnd.endCode}\`（${describeEndCode(endEv.jobEnd.endCode)}）\n\n`;
  } else {
    md += `*(找不到這個 Job 的結束紀錄——可能是擷取時仍在執行中，或結束時間落在查詢範圍之外。若是自動擷取，單一時段模式的查詢範圍僅涵蓋該時段前後約 60 分鐘；若此 Job 生命週期更長，改用全天模式（省略 \`--time\`）可取得完整範圍。)*\n\n`;
  }

  if (connectEv) {
    const nearby = findNearbyConnects(dsplogEvents, {
      requestUser: connectEv.connect.requestUser,
      clientIp: connectEv.connect.clientIp,
      date: connectEv.date,
      time: connectEv.time,
      windowMinutes: 30,
    }).filter((e) => !(e.jobName === jobName && e.jobUser === jobUser && e.jobNumber === jobNumber));

    if (nearby.length > 0) {
      md += `**同一使用者/來源在 ±30 分鐘內的其他連線**（同一次操作階段可能一併啟動的其他工作，例如互動式 5250 或 QZRCSRVS）：\n\n`;
      md += `| 時間 | Job | 使用者 |\n`;
      md += `| :--- | :--- | :--- |\n`;
      for (const e of nearby.sort((a, b) => (a.time < b.time ? -1 : 1))) {
        md += `| ${e.time} | \`${e.jobName}/${e.jobUser}/${e.jobNumber}\` | ${e.connect.requestUser} |\n`;
      }
      md += `\n`;
    }
  }

  md += `**原始 LOG 佐證**：\n\n`;
  if (connectEv) md += "```\n" + connectEv.raw + "\n```\n\n";
  if (endEv) md += "```\n" + endEv.raw + "\n```\n\n";

  return md;
}

/**
 * Single time-slot mode: dump the target job's ranked metrics at one specific interval.
 */
function buildSingleTimeContext(data, args, hostConfig, dsplogEvents) {
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
  markdown += `**User**: ${targetJob.user_name}\n`;
  markdown += `**Remote Address**: ${targetJob.remote_addr || "N/A（無 socket 連線資訊，或此份資料是加入 IP 擷取前產生的舊快取——若需要 IP，請以 npm run extract ... --forceExtract=true 重新擷取）"}\n\n`;

  markdown += `### Job 負載排行與資源消耗\n`;
  markdown += `| 維度 | 數值 (val1) | 次要值 (val2) |\n`;
  markdown += `| :--- | ---: | ---: |\n`;
  for (const [metric, m] of Object.entries(metricsData)) {
    markdown += `| ${METRIC_LABELS[metric] || metric} | ${m.val1} | ${m.val2} |\n`;
  }
  markdown += `\n*(Note: In a live environment, OS level diagnostics and Pool analysis from QAPMJOBOS would be appended here.)*\n\n`;

  const [jobNamePart, jobUserPart, jobNumberPart] = targetJob.job_name.split("/");
  markdown += buildDsplogSection(dsplogEvents, jobNamePart, jobUserPart, jobNumberPart);

  if (args.debug) {
    markdown += `\n**Raw Data (--debug)**:\n`;
    markdown += `\`\`\`json\n${JSON.stringify({ job_info: targetJob, metrics: metricsData }, null, 2)}\n\`\`\`\n`;
  }

  return markdown;
}

/**
 * QZDASOINIT-style prestart jobs get reused across many unrelated client
 * connections over a day under the same job number, so the remote address
 * isn't assumed constant — group by distinct address instead of just
 * reporting the first hit's value.
 */
function summarizeRemoteAddresses(hits) {
  const byAddr = {};
  for (const h of hits) {
    const addr = h.remote_addr || "N/A";
    if (!byAddr[addr]) byAddr[addr] = { count: 0, firstTime: h.time, lastTime: h.time };
    byAddr[addr].count++;
    if (h.time < byAddr[addr].firstTime) byAddr[addr].firstTime = h.time;
    if (h.time > byAddr[addr].lastTime) byAddr[addr].lastTime = h.time;
  }
  return Object.entries(byAddr)
    .map(([addr, info]) => ({ addr, ...info }))
    .sort((a, b) => b.count - a.count);
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
function buildFullDayContext(data, args, hostConfig, dsplogEvents) {
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
          exactHits.push({ metric, time, job_name: j.job_name, user_name: j.user_name, val1: j.val1, val2: j.val2, remote_addr: j.remote_addr });
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

  markdown += `### 1b. 遠端連線位址（Remote Address）\n`;
  const remoteAddrs = summarizeRemoteAddresses(exactHits);
  if (remoteAddrs.length === 0 || (remoteAddrs.length === 1 && remoteAddrs[0].addr === "N/A")) {
    markdown += `*(無 socket 連線資訊，或此份資料是加入 IP 擷取前產生的舊快取——若需要 IP，請以 \`npm run extract ... --forceExtract=true\` 重新擷取。)*\n\n`;
  } else {
    markdown += `> 此 Job 的 Job Number 全天固定，但若為預啟動工作（如 QZDASOINIT），同一 Job Number 可能被系統重複用於多個不相關的用戶端連線，故按出現次數列出所有觀測到的位址，而非只取第一筆。\n\n`;
    markdown += `| 遠端位址 (IP:Port) | 出現次數 | 時間範圍 |\n`;
    markdown += `| :--- | ---: | :--- |\n`;
    for (const a of remoteAddrs) {
      markdown += `| ${a.addr} | ${a.count} | ${a.firstTime} ~ ${a.lastTime} |\n`;
    }
    markdown += `\n`;
  }

  markdown += buildDsplogSection(dsplogEvents, jobParts[0], jobParts[1], jobParts[2], "### 1c. DSPLOG 交叉比對（登入/登出紀錄）");

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

/**
 * Scans peakJobs for the times (and exact "NAME/USER/NUMBER" identity) this
 * job was actually active at, to drive the live history-log fetch's window —
 * bounded to onlyTime in single-time mode, or every hit across the day
 * otherwise. Kept separate from buildFullDayContext/buildSingleTimeContext's
 * own scans since this needs to run before markdown-building starts.
 */
function collectJobActiveTimes(peakJobsForDate, jobMatchTarget, onlyTime) {
  const times = new Set();
  let matchedJobName = null;
  for (const metric of Object.keys(peakJobsForDate)) {
    const timeKeys = onlyTime ? [onlyTime] : Object.keys(peakJobsForDate[metric]);
    for (const time of timeKeys) {
      const jobs = peakJobsForDate[metric][time];
      if (!jobs) continue;
      for (const j of jobs) {
        if (jobMatches(j.job_name, jobMatchTarget)) {
          times.add(time);
          if (!matchedJobName) matchedJobName = j.job_name;
        }
      }
    }
  }
  return { times: [...times], matchedJobName };
}

/**
 * Resolves which QHST/DSPLOG events (if any) to cross-reference against the
 * RCA target job: an explicit --dsplog file wins if given; otherwise, unless
 * --fetchLog=false, auto-fetch a scoped window via a brief live connection to
 * QSYS2.HISTORY_LOG_INFO (historyLogFetcher.js) — the job's own active
 * window from the perf data, not the whole day. Never fatal: any failure
 * (unreachable host, missing feature, bad file) degrades to "no dsplog
 * section" rather than aborting the RCA, since the perf-data-based analysis
 * must keep working standalone.
 */
async function resolveDsplogEvents(args, hostId, hostConfig, data, isFullDay) {
  if (args.dsplog) {
    try {
      const text = fs.readFileSync(args.dsplog, "utf-8");
      console.log(`✔ 已讀取使用者提供的 dsplog 檔案：${args.dsplog}`);
      return parseDsplog(text);
    } catch (e) {
      console.warn(`⚠️ 讀取 --dsplog=${args.dsplog} 失敗（${e.message}），略過登入/登出紀錄交叉比對。`);
      return null;
    }
  }

  if (args.fetchLog === "false") return null;

  const peakJobsForDate = data.peakJobs[args.date];
  if (!peakJobsForDate) return null;

  const { times, matchedJobName } = collectJobActiveTimes(peakJobsForDate, args.job, isFullDay ? null : args.time);
  if (!matchedJobName || times.length === 0) return null;

  const [jobName, jobUser, jobNumber] = matchedJobName.split("/");
  let manager;
  try {
    console.log(`\n🔎 嘗試自動擷取 ${jobName}/${jobUser}/${jobNumber} 的系統歷史紀錄（QSYS2.HISTORY_LOG_INFO，範圍縮限在該 Job 活躍時段附近，非整天）...`);
    const { SourceManager } = await loadServices(args);
    manager = SourceManager.getInstance();
    await manager.registerSource(hostId, {
      host: hostConfig.host,
      user: hostConfig.user,
      password: hostConfig.password,
      port: hostConfig.port || 8076,
      ignoreUnauthorized: true,
    });
    const events = await fetchJobHistoryContext(
      manager, hostId, { jobName, jobUser, jobNumber, referenceTimes: times }, args.date,
      { onExpand: (from, to) => console.log(`  ↳ ±${from} 分鐘內找不到紀錄，擴大範圍至 ±${to} 分鐘...`) },
    );
    console.log(`✔ 已自動擷取 ${events ? events.length : 0} 筆相關系統歷史紀錄。`);
    return events;
  } catch (e) {
    console.warn(`⚠️ 自動擷取系統歷史紀錄失敗（${e.message}），略過登入/登出紀錄交叉比對。若已有現成的 DSPLOG 匯出檔，可改用 --dsplog=<path>。`);
    return null;
  } finally {
    if (manager) await manager.shutdown().catch(() => {});
  }
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
  const isFullDay = !args.time;

  const dsplogEvents = await resolveDsplogEvents(args, hostId, hostConfig, data, isFullDay);

  const markdown = isFullDay
    ? buildFullDayContext(data, args, hostConfig, dsplogEvents)
    : buildSingleTimeContext(data, args, hostConfig, dsplogEvents);

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
