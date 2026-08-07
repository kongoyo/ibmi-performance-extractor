import { partitionQuery, intCpuQuery, misumSummaryQuery, jobsQuery } from "./queries.js";
import { rankPeakJobs } from "./jobRanker.js";

// Helper to convert Julian Day of Year to MM/DD (non-leap year)
function julianToDateStr(julianStr) {
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
   * Extract performance data for the latest N days
   * @param {number} maxDays - Maximum number of recent days to extract
   * @returns {Promise<Object>} An object containing dates, times, dataByDate, peakJobsByDate, and metricSamples
   */
  async extractRecentDays(maxDays = 5) {
    // 1. Get partitions
    const partitionRes = await this.dbManager.executeQuery(this.hostId, partitionQuery(this.library));
    let partitions = partitionRes.data.map((r) => r.PARTITION_NAME.trim());

    if (partitions.length === 0) {
      throw new Error("❌ No partitions found!");
    }

    if (partitions.length > maxDays) {
      partitions = partitions.slice(0, maxDays);
    }

    const dates = [];
    const dataByDate = {};
    const peakJobsByDate = {};
    const metricSamples = { Count: [], Rsp: [], Tot: [], Int: [], Bch: [], Dsk: [], Usr: [] };

    // 2. Loop through partitions and extract
    for (const part of partitions) {
      const julianMatch = part.match(/Q(\d{3})/);
      if (!julianMatch) continue;

      const julian = julianMatch[1];
      const dateStr = julianToDateStr(julian);
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
    }

    return {
      dates,
      times: this.standardTimes,
      dataByDate,
      peakJobsByDate,
      metricSamples
    };
  }
}
