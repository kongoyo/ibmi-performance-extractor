import { partitionQuery, intCpuQuery, misumSummaryQuery, jobsQuery, diskArmQuery, librariesWithPartitionsQuery } from "./queries.js";
import { rankPeakJobs } from "./jobRanker.js";

// Helper to convert Julian Day of Year to MM/DD (non-leap year)
export function julianToDateStr(julianStr) {
  const ddd = parseInt(julianStr, 10);
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let daysLeft = ddd;
  let month = 1;
  for (let i = 0; i < 12; i++) {
    if (daysLeft <= monthDays[i]) {
      month = i + 1;
      break;
    }
    daysLeft -= monthDays[i];
  }
  return `${String(month).padStart(2, "0")}/${String(daysLeft).padStart(2, "0")}`;
}

/**
 * Scans every library on the host that holds QAPMISUM partitions and ranks
 * them by how many of their partitions fall inside targetDates. Used to
 * auto-recover when the host's configured default library has no data for
 * the requested dates, instead of the caller having to guess/retry libraries
 * by hand.
 * @param {Object} dbManager - The injected SourceManager adapter
 * @param {string} hostId - Host configuration ID
 * @param {string[]} targetDates - "MM/DD" strings to match against
 * @returns {Promise<{library: string, matchCount: number}[]>} candidates sorted by matchCount desc
 */
export async function discoverLibrariesForDates(dbManager, hostId, targetDates) {
  const res = await dbManager.executeQuery(hostId, librariesWithPartitionsQuery());
  const targetDateSet = new Set(targetDates);
  const matchCounts = {};

  for (const r of res.data) {
    const julianMatch = r.PARTITION_NAME.trim().match(/Q(\d{3})/);
    if (!julianMatch) continue;
    if (!targetDateSet.has(julianToDateStr(julianMatch[1]))) continue;
    const lib = r.LIBRARY.trim();
    matchCounts[lib] = (matchCounts[lib] || 0) + 1;
  }

  return Object.entries(matchCounts)
    .map(([library, matchCount]) => ({ library, matchCount }))
    .sort((a, b) => b.matchCount - a.matchCount);
}

export class PerformanceDataExtractor {
  /**
   * @param {Object} dbManager - The injected SourceManager adapter
   * @param {string} hostId - Host configuration ID
   * @param {string} library - Library where performance data sits
   */
  constructor(dbManager, hostId, library) {
    this.dbManager = dbManager;
    this.hostId = hostId;
    this.library = library;
    
    // Pre-calculate standard times
    this.standardTimes = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      for (let m = 0; m < 60; m += 15) {
        const mm = String(m).padStart(2, "0");
        this.standardTimes.push(`${hh}:${mm}`);
      }
    }
  }

  /**
   * Extract performance data for one or more specific dates (e.g. a single
   * date, or every date in a --dateFrom/--dateTo range expanded by the caller).
   * @param {string[]} targetDates - "MM/DD" strings to extract; partitions for
   *   any other date found in the library are skipped.
   * @returns {Promise<Object>} An object containing dates, times, dataByDate, peakJobsByDate, and metricSamples
   */
  async extractDates(targetDates) {
    // 1. Get all partitions available in the library
    const partitionRes = await this.dbManager.executeQuery(this.hostId, partitionQuery(this.library));
    const partitions = partitionRes.data.map((r) => r.PARTITION_NAME.trim());

    if (partitions.length === 0) {
      throw new Error("❌ No partitions found!");
    }

    const targetDateSet = new Set(targetDates);
    const dates = [];
    const dataByDate = {};
    const peakJobsByDate = {};
    const diskArmsByDate = {};
    const metricSamples = { Count: [], Rsp: [], Tot: [], Int: [], Bch: [], Dsk: [], Usr: [] };

    // 2. Loop through partitions and extract
    for (const part of partitions) {
      const julianMatch = part.match(/Q(\d{3})/);
      if (!julianMatch) continue;

      const julian = julianMatch[1];
      const dateStr = julianToDateStr(julian);
      if (!targetDateSet.has(dateStr)) continue;
      dates.push(dateStr);

      // Initialize structures
      dataByDate[dateStr] = {
        Count: new Array(96).fill(0),
        Rsp: new Array(96).fill(0.0),
        Tot: new Array(96).fill(0),
        Int: new Array(96).fill(0),
        Bch: new Array(96).fill(0),
        Dsk: new Array(96).fill(0),
        Usr: new Array(96).fill(0),
      };

      const aliasMisum = `QTEMP.QAPMISUM_${julian}`;
      const aliasJobl = `QTEMP.QAPMJOBL_${julian}`;
      const aliasSystem = `QTEMP.QAPMSYSTEM_${julian}`;
      const aliasDisk = `QTEMP.QAPMDISK_${julian}`;

      // Create Aliases
      await this.dbManager.executeQuery(this.hostId, `CREATE OR REPLACE ALIAS ${aliasMisum} FOR ${this.library}.QAPMISUM (${part})`);
      await this.dbManager.executeQuery(this.hostId, `CREATE OR REPLACE ALIAS ${aliasJobl} FOR ${this.library}.QAPMJOBL (${part})`);
      await this.dbManager.executeQuery(this.hostId, `CREATE OR REPLACE ALIAS ${aliasSystem} FOR ${this.library}.QAPMSYSTEM (${part})`);
      await this.dbManager.executeQuery(this.hostId, `CREATE OR REPLACE ALIAS ${aliasDisk} FOR ${this.library}.QAPMDISK (${part})`);

      // Query Interactive CPU
      const intCpuRes = await this.dbManager.executeQuery(this.hostId, intCpuQuery(aliasJobl), [], undefined, undefined, 10000);
      const intCpuByInterval = {};
      intCpuRes.data.forEach((r) => {
        intCpuByInterval[parseInt(r.INTNUM, 10)] = parseFloat(r.INT_CPU_MS) || 0;
      });

      // Query Interval Summary
      const misumRes = await this.dbManager.executeQuery(this.hostId, misumSummaryQuery(aliasMisum, aliasSystem, aliasDisk));
      const intervals = misumRes.data;

      const intnumToTime = {};
      intervals.forEach((r) => {
        const intVal = parseInt(r.INTNUM, 10);
        intnumToTime[intVal] = r.Time;

        const sysCta = parseFloat(r.SysCta) || 0;
        const intCpuMs = intCpuByInterval[intVal] || 0;
        const totPct = r.Tot || 0;
        const intPct = sysCta > 0 ? Math.trunc((intCpuMs / sysCta) * 100.0) : 0;
        const bchPct = Math.max(0, totPct - intPct);

        const idx = this.standardTimes.indexOf(r.Time);
        if (idx !== -1) {
          dataByDate[dateStr].Count[idx] = r.Count || 0;
          dataByDate[dateStr].Rsp[idx] = parseFloat(r.Rsp) || 0.0;
          dataByDate[dateStr].Tot[idx] = totPct;
          dataByDate[dateStr].Int[idx] = intPct;
          dataByDate[dateStr].Bch[idx] = bchPct;
          dataByDate[dateStr].Dsk[idx] = r.Dsk || 0;
          dataByDate[dateStr].Usr[idx] = r.Usr || 0;

          metricSamples.Count.push(r.Count || 0);
          metricSamples.Rsp.push(parseFloat(r.Rsp) || 0.0);
          metricSamples.Tot.push(totPct);
          metricSamples.Int.push(intPct);
          metricSamples.Bch.push(bchPct);
          metricSamples.Dsk.push(r.Dsk || 0);
          metricSamples.Usr.push(r.Usr || 0);
        }
      });

      // Query and Rank Jobs
      const jobsRes = await this.dbManager.executeQuery(this.hostId, jobsQuery(aliasJobl), [], undefined, undefined, 10000);

      // Delegate ranking to internal module
      peakJobsByDate[dateStr] = rankPeakJobs(jobsRes.data, intnumToTime);

      // Query top-5-busiest-disk-unit-per-interval detail (not job-scoped, so
      // kept separate from peakJobsByDate; keyed by time like peakJobs).
      // `drn` (device resource name) is the unique per-disk-unit identity —
      // `arm_id` is NOT unique (empirically confirmed 2026-08-08: one DSARM
      // value can span multiple physically distinct disks in a SAN-attached
      // environment), kept only as secondary array/rank grouping context. See
      // the comment on diskArmQuery in queries.js.
      const diskArmRes = await this.dbManager.executeQuery(this.hostId, diskArmQuery(aliasDisk), [], undefined, undefined, 10000);
      const diskArmsForDate = {};
      diskArmRes.data.forEach((r) => {
        const intVal = parseInt(r.INTNUM, 10);
        const timeKey = intnumToTime[intVal];
        if (!timeKey) return;
        if (!diskArmsForDate[timeKey]) diskArmsForDate[timeKey] = [];
        diskArmsForDate[timeKey].push({
          drn: r.DRN,
          arm_id: r.ARM_ID,
          busy_pct: parseInt(r.BUSY_PCT, 10),
          reads: parseInt(r.READS, 10) || 0,
          writes: parseInt(r.WRITES, 10) || 0,
          srvt_ms: parseFloat(r.SRVT_MS) || 0,
          wait_ms: parseFloat(r.WAIT_MS) || 0,
          cache_fast_writes: parseInt(r.CACHE_FAST_WRITES, 10) || 0,
        });
      });
      // Defensive re-sort by busy% descending within each interval (SQL ORDER BY
      // already guarantees this, but mirrors rankPeakJobs's own defensive re-sort).
      Object.values(diskArmsForDate).forEach((arms) => arms.sort((a, b) => b.busy_pct - a.busy_pct));
      diskArmsByDate[dateStr] = diskArmsForDate;
    }

    return {
      dates,
      times: this.standardTimes,
      dataByDate,
      peakJobsByDate,
      diskArms: diskArmsByDate,
      metricSamples
    };
  }
}
