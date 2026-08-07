/**
 * Group and rank the jobs based on the SQL query results.
 * This file encapsulates the array manipulation for the Top 10 peak jobs.
 */
export function rankPeakJobs(allJobs, intnumToTime) {
  const peakJobs = {};
  const metrics = ["Count", "Rsp", "Tot", "Int", "Bch", "Dsk", "Usr", "Szwt"];
  metrics.forEach((m) => {
    peakJobs[m] = {};
  });

  allJobs.forEach((j) => {
    const intVal = parseInt(j.INTNUM, 10);
    const timeKey = intnumToTime[intVal];
    if (!timeKey) return; // Skip if no matching interval summary time

    // Tot, Int, Bch (CPU rank) -> val1: CPU_MS, val2: IO_COUNT
    if (parseInt(j.CPU_RANK, 10) <= 10) {
      ["Tot", "Int", "Bch"].forEach((m) => {
        if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
        const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
        if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
          peakJobs[m][timeKey].push({
            job_name: jobFull,
            user_name: j.USER_NAME,
            val1: parseFloat(j.CPU_MS),
            val2: parseInt(j.IO_COUNT, 10),
          });
        }
      });
    }

    // Count (Transaction count rank) -> val1: TRANS_COUNT, val2: RESPONSE_SEC
    if (parseInt(j.TRANS_RANK, 10) <= 10) {
      const m = "Count";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.TRANS_COUNT, 10),
          val2: parseFloat(j.RESPONSE_SEC),
        });
      }
    }

    // Rsp (Response time rank) -> val1: RESPONSE_SEC, val2: IO_COUNT
    if (parseInt(j.RSP_RANK, 10) <= 10) {
      const m = "Rsp";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseFloat(j.RESPONSE_SEC),
          val2: parseInt(j.IO_COUNT, 10),
        });
      }
    }

    // Dsk (IO rank) -> val1: IO_COUNT, val2: CPU_MS
    if (parseInt(j.IO_RANK, 10) <= 10) {
      const m = "Dsk";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.IO_COUNT, 10),
          val2: parseFloat(j.CPU_MS),
        });
      }
    }

    // Usr (Page fault rank) -> val1: FAULTS, val2: CPU_MS
    if (parseInt(j.FAULT_RANK, 10) <= 10) {
      const m = "Usr";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.FAULTS, 10),
          val2: parseFloat(j.CPU_MS),
        });
      }
    }

    // Szwt (Seize/Wait rank) -> val1: SZWT_MS, val2: CPU_MS
    if (parseInt(j.SZWT_RANK, 10) <= 10) {
      const m = "Szwt";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseFloat(j.SZWT_MS),
          val2: parseFloat(j.CPU_MS),
        });
      }
    }
  });

  // Sort each array correctly (since DB might return them out of order due to Top 10 nature)
  // We sort by val1 descending.
  metrics.forEach((m) => {
    Object.keys(peakJobs[m]).forEach((timeKey) => {
      peakJobs[m][timeKey].sort((a, b) => b.val1 - a.val1);
    });
  });

  return peakJobs;
}
