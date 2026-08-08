import fs from "fs";
import path from "path";
import { SKILL_ROOT, resolveDataAndOutputDirs } from "./pathResolver.js";

export const METRIC_LABELS = {
  Count: "Transaction Count（交易量）",
  Rsp: "Response Time（回應時間）",
  Tot: "Total CPU",
  Int: "Interactive CPU",
  Bch: "Batch CPU",
  Dsk: "Disk I/O（磁碟I/O）",
  Usr: "Page Faults（分頁缺失）",
  Szwt: "Seize/Wait Time（鎖定等待時間）",
};

export function jobMatches(jobName, target) {
  return jobName === target || jobName.includes(target) || target.includes(jobName);
}

// Only these two metrics share the same unit between a job's peakJobs val1 and
// the system-wide time series in data.data[date][metric] (both are counts/seconds).
// Tot/Int/Bch (CPU_MS vs CPU%), Dsk (IO_COUNT vs disk-busy%), and Usr (raw FAULTS
// vs faults/sec rate) use different scales at the job level vs the system level —
// dividing one by the other produces meaningless percentages, so those metrics
// must stay job-level-to-job-level (see computeJobLevelDayMax below).
export const SYSTEM_COMPARABLE_METRICS = new Set(["Count", "Rsp"]);

/**
 * For metrics where job-level and system-level units don't match, "day peak" has
 * to be computed from other jobs' peakJobs entries at the same metric (rank-0 per
 * interval, since peakJobs is pre-sorted descending) rather than the system series.
 */
export function computeJobLevelDayMax(peakJobsForDate, metric) {
  const byTime = peakJobsForDate[metric];
  if (!byTime) return { maxVal: null, maxTime: null };
  let maxVal = null;
  let maxTime = null;
  for (const time of Object.keys(byTime)) {
    const jobs = byTime[time];
    if (!jobs || jobs.length === 0) continue;
    const top = jobs[0].val1; // pre-sorted descending
    if (maxVal == null || top > maxVal) {
      maxVal = top;
      maxTime = time;
    }
  }
  return { maxVal, maxTime };
}

// Machine-readable context files (for the AI to read) live in their own
// subfolder, separate from human-readable reports and HTML dashboards that sit
// directly under outDir — keeps `outputs/<host>/<lib>/` browsable by people.
const CONTEXT_SUBDIR = "context";

export function resolveContextDir(outDir) {
  const contextDir = path.join(outDir, CONTEXT_SUBDIR);
  fs.mkdirSync(contextDir, { recursive: true });
  return contextDir;
}

/**
 * Above `threshold` hits, a chronological row-per-interval table stops being
 * something an AI needs to read in full (a job active for 10 hours produces
 * 150+ near-identical rows) — collapse to per-metric stats (count/range/min/
 * max/avg) plus the handful of rows that matter (day-peak moments). Below the
 * threshold, keep every row: short-lived jobs are exactly where per-interval
 * detail is cheap and still useful.
 */
export function summarizeHits(hits, threshold = 20) {
  if (hits.length <= threshold) {
    return { detailed: true, hits };
  }

  const byMetric = {};
  for (const h of hits) {
    if (!byMetric[h.metric]) byMetric[h.metric] = [];
    byMetric[h.metric].push(h);
  }

  const metricSummaries = Object.entries(byMetric).map(([metric, list]) => {
    list.sort((a, b) => (a.time < b.time ? -1 : 1));
    const vals = list.map(h => h.val1);
    return {
      metric,
      count: list.length,
      firstTime: list[0].time,
      lastTime: list[list.length - 1].time,
      minVal1: Math.min(...vals),
      maxVal1: Math.max(...vals),
      avgVal1: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
    };
  });

  const dayPeakHits = hits.filter(h => h.isDayPeak).sort((a, b) => (a.time < b.time ? -1 : 1));

  return { detailed: false, metricSummaries, dayPeakHits };
}

// Mirrors test_pipeline.js's local enumerateDateRange (non-leap-year model, same
// as extractor.js's julianToDateStr assumes) — duplicated here rather than
// imported since test_pipeline.js pulls in heavier side-effecting deps
// (execSync, loadServices) not needed just to expand a date range.
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
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

/**
 * Locate the perf_*.json cache under dataDir whose `dates` array is a superset
 * of every day in [dateFrom..dateTo] — for trend/capacity reports that need the
 * whole range, not just one date (see resolveJsonPath below for the single-date
 * case). Deliberately does NOT match on filename label alone: the label reflects
 * whatever was actually extracted (which can have gaps if a partition was
 * missing), so we verify full day-by-day coverage against the real `dates` array.
 */
export function resolveRangeJsonPath(dataDir, dateFrom, dateTo) {
  const requiredDates = enumerateDateRange(dateFrom, dateTo);
  const candidates = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter(f => f.startsWith("perf_") && f.endsWith(".json"))
    : [];
  for (const f of candidates) {
    const candidatePath = path.join(dataDir, f);
    try {
      const candidateData = JSON.parse(fs.readFileSync(candidatePath, "utf-8"));
      if (Array.isArray(candidateData.dates) && requiredDates.every(d => candidateData.dates.includes(d))) {
        return candidatePath;
      }
    } catch {
      // skip unreadable/malformed candidate
    }
  }
  return null;
}

/**
 * Locate the perf_*.json cache under dataDir that covers `date`, preferring an
 * exact single-date file over a range file that happens to include it.
 */
export function resolveJsonPath(dataDir, date) {
  const label = date.replace(/\//g, "");
  const exactPath = path.join(dataDir, `perf_${label}.json`);
  if (fs.existsSync(exactPath)) return exactPath;

  const candidates = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter(f => f.startsWith("perf_") && f.endsWith(".json"))
    : [];
  for (const f of candidates) {
    const candidatePath = path.join(dataDir, f);
    try {
      const candidateData = JSON.parse(fs.readFileSync(candidatePath, "utf-8"));
      if (Array.isArray(candidateData.dates) && candidateData.dates.includes(date)) {
        return candidatePath;
      }
    } catch {
      // skip unreadable/malformed candidate
    }
  }
  return null;
}

/**
 * Resolves which library's cached perf_*.json to read for a host + date spec,
 * auto-falling back to sibling library directories under data/<host>/ when
 * the caller didn't pin --lib and the default library has no cached data
 * covering the requested date(s) — a host's Collection Services data can be
 * split across more than one *MGTCOL library, and hosts_config.json only
 * names one as the default. This exists so every analysis script (rca,
 * anomaly, digest, trend, disk-hotspot) locates the right library
 * deterministically instead of the caller guessing --lib by trial and error.
 *
 * @param {object} hostConfig
 * @param {string} hostId
 * @param {object} args - parsed CLI args (checked for args.lib)
 * @param {{date: string}|{dateFrom: string, dateTo: string}} dateSpec
 * @returns {{
 *   library: string, dataDir: string, outDir: string,
 *   jsonPath: string|null, triedLibraries: string[], autoSwitched: boolean
 * }}
 */
export function resolveLibraryAndJsonPath(hostConfig, hostId, args, dateSpec) {
  const findJson = (dataDir) =>
    dateSpec.date
      ? resolveJsonPath(dataDir, dateSpec.date)
      : resolveRangeJsonPath(dataDir, dateSpec.dateFrom, dateSpec.dateTo);

  const primaryLibrary = args.lib || hostConfig.library || "QPFRDATA";
  const primaryDirs = resolveDataAndOutputDirs(hostConfig, hostId, primaryLibrary);
  const primaryJsonPath = findJson(primaryDirs.dataDir);

  if (primaryJsonPath || args.lib) {
    return { library: primaryLibrary, ...primaryDirs, jsonPath: primaryJsonPath, triedLibraries: [primaryLibrary], autoSwitched: false };
  }

  const hostDataRoot = path.join(SKILL_ROOT, "data", hostConfig.host);
  const siblingLibraries = fs.existsSync(hostDataRoot)
    ? fs.readdirSync(hostDataRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== primaryLibrary)
        .map((d) => d.name)
    : [];

  const triedLibraries = [primaryLibrary];
  for (const lib of siblingLibraries) {
    triedLibraries.push(lib);
    const dirs = resolveDataAndOutputDirs(hostConfig, hostId, lib);
    const candidateJsonPath = findJson(dirs.dataDir);
    if (candidateJsonPath) {
      return { library: lib, ...dirs, jsonPath: candidateJsonPath, triedLibraries, autoSwitched: true };
    }
  }

  return { library: primaryLibrary, ...primaryDirs, jsonPath: null, triedLibraries, autoSwitched: false };
}
