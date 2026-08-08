/**
 * Decodes QAPMJOBL's remote-socket fields (fetched as safe hex strings by
 * jobsQuery's HEX(JBIPAF)/HEX(JBIPAD)) into a human-readable "ip:port"
 * string. X'00' means no socket was ever established or it has already
 * terminated (references/qapmjobl_fields.md) — returns null in that case,
 * same as missing/malformed data, so callers can render "N/A" uniformly.
 */
export function decodeRemoteAddress(ipFamilyHex, ipHex, port) {
  if (!ipHex) return null;
  const family = (ipFamilyHex || "").trim().toUpperCase();
  const portSuffix = port ? `:${port}` : "";

  if (family === "02") {
    const bytes = ipHex.slice(0, 8).match(/.{2}/g);
    if (!bytes || bytes.length < 4) return null;
    return bytes.map((b) => parseInt(b, 16)).join(".") + portSuffix;
  }
  if (family === "18") {
    const clean = ipHex.slice(0, 32).toLowerCase();
    if (clean.length < 32) return null;

    // IPv4-mapped IPv6 (::ffff:a.b.c.d — bytes 0-9 zero, bytes 10-11 0xFFFF,
    // real address in the last 4 bytes) is the common case for an IPv4
    // client on a dual-stack socket: render it as plain IPv4 instead of the
    // technically-correct but much less readable colon form.
    const bytePairs = clean.match(/.{2}/g);
    const isV4Mapped = bytePairs.slice(0, 10).every((b) => b === "00") && bytePairs[10] === "ff" && bytePairs[11] === "ff";
    if (isV4Mapped) {
      return bytePairs.slice(12, 16).map((b) => parseInt(b, 16)).join(".") + portSuffix;
    }

    return clean.match(/.{4}/g).join(":").toLowerCase() + portSuffix;
  }
  return null; // X'00' = unset, or an unrecognized family
}

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

    const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
    const remoteAddr = decodeRemoteAddress(j.IP_FAMILY_HEX, j.IP_HEX, j.REMOTE_PORT);

    // Tot, Int, Bch (CPU rank) -> val1: CPU_MS, val2: IO_COUNT
    if (parseInt(j.CPU_RANK, 10) <= 10) {
      ["Tot", "Int", "Bch"].forEach((m) => {
        if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
        if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
          peakJobs[m][timeKey].push({
            job_name: jobFull,
            user_name: j.USER_NAME,
            val1: parseFloat(j.CPU_MS),
            val2: parseInt(j.IO_COUNT, 10),
            remote_addr: remoteAddr,
          });
        }
      });
    }

    // Count (Transaction count rank) -> val1: TRANS_COUNT, val2: RESPONSE_SEC
    if (parseInt(j.TRANS_RANK, 10) <= 10) {
      const m = "Count";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.TRANS_COUNT, 10),
          val2: parseFloat(j.RESPONSE_SEC),
          remote_addr: remoteAddr,
        });
      }
    }

    // Rsp (Response time rank) -> val1: RESPONSE_SEC, val2: IO_COUNT
    if (parseInt(j.RSP_RANK, 10) <= 10) {
      const m = "Rsp";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseFloat(j.RESPONSE_SEC),
          val2: parseInt(j.IO_COUNT, 10),
          remote_addr: remoteAddr,
        });
      }
    }

    // Dsk (IO rank) -> val1: IO_COUNT, val2: CPU_MS
    if (parseInt(j.IO_RANK, 10) <= 10) {
      const m = "Dsk";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.IO_COUNT, 10),
          val2: parseFloat(j.CPU_MS),
          remote_addr: remoteAddr,
        });
      }
    }

    // Usr (Page fault rank) -> val1: FAULTS, val2: CPU_MS
    if (parseInt(j.FAULT_RANK, 10) <= 10) {
      const m = "Usr";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseInt(j.FAULTS, 10),
          val2: parseFloat(j.CPU_MS),
          remote_addr: remoteAddr,
        });
      }
    }

    // Szwt (Seize/Wait rank) -> val1: SZWT_MS, val2: CPU_MS
    if (parseInt(j.SZWT_RANK, 10) <= 10) {
      const m = "Szwt";
      if (!peakJobs[m][timeKey]) peakJobs[m][timeKey] = [];
      if (!peakJobs[m][timeKey].some((x) => x.job_name === jobFull)) {
        peakJobs[m][timeKey].push({
          job_name: jobFull,
          user_name: j.USER_NAME,
          val1: parseFloat(j.SZWT_MS),
          val2: parseFloat(j.CPU_MS),
          remote_addr: remoteAddr,
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
