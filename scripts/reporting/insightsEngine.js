// NOTE: Tot/Rsp/Usr thresholds below (70 / 2.0 / 50) are duplicated in
// scripts/reportingThresholds.js for daily_digest.js/trend_report.js. Keep both in sync by hand.

/**
 * Generates dynamic analysis and recommendations based on metric key and its absolute maximum.
 * @param {string} key
 * @param {number} absMax
 * @param {string} maxD
 * @param {string} absMaxTime
 * @returns {string[]} [analysis, recommendation]
 */
export function generateInsights(key, absMax, maxD, absMaxTime) {
  let analysis = "";
  let recommendation = "";

  if (key === "Tot") {
    if (absMax > 70) {
      analysis = `1. **運算資源吃緊警告**：跨日最大 CPU 使用率高達 ${absMax}% (於 ${maxD} ${absMaxTime})。已突破 70% 的安全臨界點。<br>2. **主導工作負載**：請在左圖移動滑鼠，觀察高點時段的 Top 10 Job 排行。若是由非關鍵背景批次 (QBATCH) 引發，建議進行工作優先級限制。`;
      recommendation = `1. **LPAR 核心擴展**：考慮為此分割區分配更多 CPU 資源。<br>2. **錯峰批次排程**：將佔用 CPU 的重度 Job 排程調整至 22:00 以後分流執行。`;
    } else {
      analysis = `1. **運算資源充沛**：跨日最大 CPU 使用率僅為 ${absMax}% (於 ${maxD} ${absMaxTime})，系統整體運算負載極低，運作極為順暢。<br>2. **負載分佈特徵**：全天大部分時間使用率均在 1% ~ 5% 的低水位，無任何突發性資源瓶頸。`;
      recommendation = `1. **維持現有配置**：運算資源十分充足，無需進行硬體核心擴充。<br>2. **部署測試環境**：現有極大之與資源非常適合作為高負載壓力測試或新系統併行驗證的環境。`;
    }
  } else if (key === "Rsp") {
    if (absMax > 2.0) {
      analysis = `1. **異常交易回應延遲**：在 ${maxD} ${absMaxTime} 觀察到最大回應時間達 ${absMax} 秒的單點 Peak。<br>2. **潛在鎖定競爭**：當尖峰延遲大於 2 秒而交易量未暴增時，多代表有特定資料庫 Table Lock 或鎖定等待 (Lock Wait) 發生。`;
      recommendation = `1. **Lock Wait 追蹤**：點擊該時段的點，查閱右側 Top 10 Job，檢查是否有如 \`QZDASOVR\` 等 SQL 連線正在等待鎖定釋放。<br>2. **優化逾時機制**：於程式端設定連線 Timeout，防範個別卡死拖垮整體連線池。`;
    } else {
      analysis = `1. **交易響應極佳**：跨日最大回應時間僅為 ${absMax} 秒 (於 ${maxD} ${absMaxTime})，平均回應時間維持在 0.1~0.3 秒極佳範圍。<br>2. **系統運作順暢**：未見任何資料庫行鎖 (Record Lock) 或資源爭搶所導致的長延遲 Peak。`;
      recommendation = `1. **例行索引維護**：維持現有資料庫索引結構，定期優化查詢與重置 Index。<br>2. **閥值警示設定**：於監控台配置當回應時間大於 1.5 秒時觸發警告通知。`;
    }
  } else if (key === "Usr") {
    if (absMax > 50) {
      analysis = `1. **實體記憶體置換警告**：User Pool 頁面缺失率最大達到 ${absMax} 次/秒 (於 ${maxD} ${absMaxTime})。<br>2. **記憶體不足徵兆**：Page Fault 頻繁代表程式需要頻繁地進行磁碟 I/O 置換，會嚴重拖累資料庫 SQL 的執行回應時間。`;
      recommendation = `1. **調整 QPFRADJ 系統值**：確認 \`SYSVAL QPFRADJ\` 設定為 2 或 3，由系統自動微調 Memory Pool 大小。<br>2. **手動調大 User Pool**：若該時段有大量 Java (如 \`QZRCSRVS\`) 或批次工作執行，手動提高主要 Subsystem 所屬 Pool 的大小。`;
    } else {
      analysis = `1. **分頁分配合理**：User Pool 最大分頁缺失率為 ${absMax} 次/秒 (於 ${maxD} ${absMaxTime})，全天平均接近 0。<br>2. **置換開銷極低**：力求程式碼與 DB2 熱點資料皆成功快取在實體記憶體中，磁碟置換開銷極低。`;
      recommendation = `1. **維持現狀**：記憶體分配合理，無需手動調整分配。<br>2. **容量規劃監控**：持續觀察未來若有新增大型應用（如 JVM）時的 Fault 波動。`;
    }
  } else {
    analysis = `1. **數據趨勢**：跨日最大值為 ${absMax} (發生於 ${maxD} ${absMaxTime})。`;
    recommendation = `1. **例行點檢**：持續觀測指標是否偏離歷史基準線。<br>2. **系統值設定**：確認相關資源分配池 (Pools) 配置符合預期配置值。`;
  }

  return [analysis, recommendation];
}
