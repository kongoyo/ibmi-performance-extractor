/**
 * Calculates max, max_time, and avg for each metric and date.
 * Returns a nested object: stats[metric_key][date] = { "max", "max_time", "avg" }
 *
 * @param {string[]} dates
 * @param {string[]} times
 * @param {Object} dataByDate
 * @param {Object[]} metrics
 * @returns {Object}
 */
export function calculateStats(dates, times, dataByDate, metrics) {
  const stats = {};
  for (const m of metrics) {
    const key = m.key;
    stats[key] = {};
    for (const d of dates) {
      const arr = (dataByDate[d] && dataByDate[d][key]) || [];
      if (arr.length === 0) {
        stats[key][d] = { max: 0, max_time: "N/A", avg: 0.0 };
        continue;
      }

      // Safe max and max_index calculation to avoid call stack size exceeded
      let maxVal = arr[0];
      let maxIdx = 0;
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
        sum += val;
      }

      const avgVal = parseFloat((sum / arr.length).toFixed(2));
      stats[key][d] = {
        max: maxVal,
        max_time: maxIdx < times.length ? times[maxIdx] : "N/A",
        avg: avgVal,
      };
    }
  }
  return stats;
}

/**
 * Returns the UI headers and units for the Top 10 jobs panel based on the metric key.
 * @param {string} key
 * @returns {Object}
 */
export function getPanelHeaders(key) {
  if (key === "Rsp") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 交易回應時間排行",
      val_header: "回應時間",
      last_header: "實體 I/O 次數",
      val_unit: "秒",
      last_unit: "次",
    };
  } else if (key === "Count") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 交易次數排行",
      val_header: "交易次數",
      last_header: "平均回應時間",
      val_unit: "次",
      last_unit: "秒",
    };
  } else if (key === "Dsk") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 磁碟 I/O 排行",
      val_header: "I/O 次數",
      last_header: "CPU 耗時",
      val_unit: "次",
      last_unit: "ms",
    };
  } else if (key === "Usr") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 分頁缺失排行",
      val_header: "分頁缺失",
      last_header: "CPU 耗時",
      val_unit: "次",
      last_unit: "ms",
    };
  } else if (key === "Tot") {
    return {
      title: "🔥 尖峰時段 Top 10 Job CPU 負載排行",
      val_header: "CPU 耗時",
      last_header: "總 I/O 次數",
      val_unit: "ms",
      last_unit: "次",
    };
  } else if (key === "Int") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 互動式 CPU 排行",
      val_header: "CPU 耗時",
      last_header: "交易回應時間",
      val_unit: "ms",
      last_unit: "秒",
    };
  } else if (key === "Bch") {
    return {
      title: "🔥 尖峰時段 Top 10 Job 批次 CPU 排行",
      val_header: "CPU 耗時",
      last_header: "實體 I/O 次數",
      val_unit: "ms",
      last_unit: "次",
    };
  } else {
    return {
      title: "🔥 尖峰時段 Top 10 Job 負載排行",
      val_header: "數值 1",
      last_header: "數值 2",
      val_unit: "",
      last_unit: "",
    };
  }
}
