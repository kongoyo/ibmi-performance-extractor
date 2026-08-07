/**
 * Group and rank the jobs based on the SQL query results.
 * This file encapsulates the array manipulation for the Top 10 peak jobs.
 */
export function rankPeakJobs(allJobs, intnumToTime) {
  const peakJobs = {};
  const metrics = ["Count", "Rsp", "Tot", "Int", "Bch", "Dsk", "Usr"];
  metrics.forEach((m) => {
    peakJobs[m] = {};
  });

  allJobs.forEach((j) => {
    const intVal = parseInt(j.INTNUM, 10);
    const timeKey = intnumToTime[intVal];
    if (!timeKey) return; // Skip if no matching interval summary time

    // Tot, Int, Bch (CPU rank)
    if (parseInt(j.CPU_RANK, 10) <= 10) {
      ["Tot", "Int", "Bch"].forEach((m) => {
        if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
        const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
        if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
          peakJobs[m][timeKey].push({
            job_name: jobFull,
            user_name: j.USER_NAME,
            cpu_ms: parseFloat(j.CPU_MS),
            faults: parseInt(j.FAULTS, 10),
          });
        }
      });
    }

    // Count (Transaction count rank)
    if (parseInt(j.TRANS_RANK, 10) <= 10) {
      const m = "Count";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          cpu_ms: parseInt(j.TRANS_COUNT, 10),
          faults: parseFloat(j.RESPONSE_SEC),
        });
      }
    }

    // Rsp (Response time rank)
    if (parseInt(j.RSP_RANK, 10) <= 10) {
      const m = "Rsp";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          cpu_ms: parseFloat(j.RESPONSE_SEC),
          faults: parseInt(j.TRANS_COUNT, 10),
        });
      }
    }

    // Dsk (IO rank)
    if (parseInt(j.IO_RANK, 10) <= 10) {
      const m = "Dsk";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          cpu_ms: parseFloat(j.CPU_MS),
          faults: parseInt(j.IO_COUNT, 10),
        });
      }
    }

    // Usr (Page fault rank)
    if (parseInt(j.FAULT_RANK, 10) <= 10) {
      const m = "Usr";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          cpu_ms: parseFloat(j.CPU_MS),
          faults: parseInt(j.FAULTS, 10),
        });
      }
    }
  });

  // Sort arrays in descending order in JS to guarantee correctness
  metrics.forEach((m) => {
    for (const timeKey in peakJobs[m]) {
      const arr = peakJobs[m][timeKey];
      if (m === "Dsk" || m === "Usr") {
        arr.sort((a, b) => b.faults - a.faults);
      } else {
        arr.sort((a, b) => b.cpu_ms - a.cpu_ms);
      }
      // Slice to top 10
      peakJobs[m][timeKey] = arr.slice(0, 10);
    }
  });

  return peakJobs;
}
