# RCA 根因診斷執行原則

當使用者要求對特定時段進行根因分析時，AI 應主動透過 `SourceManager` 連線至 IBM i，依序從以下五個維度取得佐證證據，並以「時間、Job、影響時段」為三個必要敘述要素組成 RCA 報告：

1. **系統層次時序**：查詢目標 Interval 前後 ±2 個區間的系統摘要（交易數、回應時間、CPU、分頁缺失），建立時序背景。
2. **Job 負載排行**：對目標 Interval 查詢 Top 15 高負載 Job，依目標指標（I/O 次數、分頁缺失、CPU）排序。
3. **OS 層次診斷**：對排行前列的 Job 查詢 OS 層次統計，識別 Native I/O vs SQL、子系統歸屬、交易模式。
4. **Pool 聚合分析**：按記憶體 Pool 彙總資源消耗，識別哪個 Pool 正在承受壓力。
5. **跨時段趨勢**：查詢前後 10 個 Interval 的 Job 趨勢，判斷異常是突發性還是持續性。

> 詳細的查詢 SQL 範本與欄位對照，請參閱 `references/field_reference.md`。
