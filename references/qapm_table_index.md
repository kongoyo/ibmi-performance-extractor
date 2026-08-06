# IBM i Collection Services 資料檔索引（QAPM*）

> **這是什麼**：IBM 官方對各 `QAPM*` 收集服務資料檔的**表級用途說明**，用途是在需要擴充新指標時快速縮小「候選表」範圍。
>
> **⚠️ 不保證欄位存在或有意義**：本表只是官方文件的表級描述文字，跟曾經誤導過本專案的 `JBPAGF` 說明文字（"PAG faults"，實測卻是死欄位）屬於同一種不可盡信的來源層級。任何要實際使用的表，都必須走 [field_reference.md](field_reference.md) 開頭規定的流程——`checkSchema` 確認欄位存在、對真實資料實測確認欄位有意義——才能寫進 `field_manifest.json` 或 `field_reference.md`。本表本身**不是**驗證結果，只是查找起點。
>
> 已深度驗證、可信賴的欄位層級知識見 [field_reference.md](field_reference.md)（目前涵蓋 `QAPMISUM`/`QAPMSYSTEM`/`QAPMDISK`/`QAPMJOBL`/`QAPMJOBOS` 五張表）。

| 資料檔 | 用途說明 |
| ---- | ---- |
| `QAPMAPPN` | 定義「進階點對點網路 (APPN)」資料檔記錄中的欄位。 |
| `QAPMARMTRT` | 包含 `QAPMUSRTNS` 檔案中所報告「應用程式回應測量 (ARM)」異動類型的相關資訊。 |
| `QAPMASYN` | 包括非同步檔案項目，並列出非同步檔案中的欄位。 |
| `QAPMBSC` | 包括二進位同步檔案項目，並列出二進位同步檔案中的欄位。 |
| `QAPMBUS` | 包含外部系統匯流排的資料。 |
| `QAPMBUSINT` | 包含內部系統匯流排的資料。 |
| `QAPMCIOP` | 包括通訊 IOP 檔案項目，並列出通訊 IOP 檔案中的欄位。 |
| `QAPMDDI` | 定義分散式資料介面 (DDI) 檔案記錄中的欄位。 |
| `QAPMDIOP` | 包含儲存裝置 (磁碟) IOP 檔案項目。 |
| `QAPMDISK` | 包括磁碟檔項目，且每一個磁碟資源包含一筆記錄。（已用於 High Disk 計算，見 `field_reference.md`） |
| `QAPMDISKRB` | 包括磁碟檔案回應儲存區項目，且每一個裝置資源名稱都包含一筆記錄。預定與 `QAPMDISK` 一起使用。 |
| `QAPMDOMINO` | 包含 Domino for i5/OS 種類所收集的資料。 |
| `QAPMDPS` | 包含資料埠服務效能資料（LIC，支援叢集節點間傳送大量資料）。 |
| `QAPMECL` | 包括記號環網路檔案登錄，並列出記號環區域網路 (LAN) 檔案中的欄位。 |
| `QAPMETH` | 包括乙太網路檔案項目，並列出乙太網路檔案中的欄位。 |
| `QAPMETHP` | 包括與 SR-IOV 配接卡乙太網路埠相關聯之作用中乙太網路線路說明的實體埠乙太網路通訊協定統計資料。 |
| `QAPMFRLY` | 包括訊框傳送計數器登錄。 |
| `QAPMHDLC` | 包括高階資料鏈結控制 (HDLC) 檔案項目。 |
| `QAPMHTTPB` | 包含 IBM HTTP Server (Apache) 種類所收集的基本資料。 |
| `QAPMHTTPD` | 包含 HTTP Server (Apache) 種類所收集的詳細資料。 |
| `QAPMIDLC` | 包括 ISDN 資料鏈結控制檔登錄，並列出 IDLC 檔中的欄位。 |
| `QAPMIOPD` | 列出 IOP 延伸資料檔中的欄位。 |
| `QAPMISUM` | 包含間隔摘要資訊。（已用於 CPU/交易/回應時間/分頁缺失計算，見 `field_reference.md`） |
| `QAPMJOBMI` | 包含使用 `*JOBMI` 種類收集的作業、主要及次要執行緒資料。 |
| `QAPMJOBOS` | 包含系統工作特定的資料。（已用於 RCA 根因診斷，見 `field_reference.md`） |
| `QAPMJOBS` / `QAPMJOBL` | 提供 `QAPMJOBL` 檔案以與效能監視器相容，結合 `QAPMJOBMI` 與 `QAPMJOBOS` 的資料。（`QAPMJOBL` 已用於 Top Job 排行，見 `field_reference.md`） |
| `QAPMJOBSR` | 包含已執行儲存或還原作業之工作的資料。 |
| `QAPMJOBWT` | 包含工作、作業及執行緒等待狀況的相關資訊。 |
| `QAPMJOBWTD` | 包含 `QAPMJOBWT` 中計數器組的說明。 |
| `QAPMJOBWTG` | 包含 `QAPMJOBWT` 中無法使用之工作、作業及執行緒現行等待狀況的相關資訊。 |
| `QAPMJSUM` | 包含工作摘要資訊。 |
| `QAPMJVM` | 包含取樣資料時處理程序內作用中的 Java 虛擬機器 (JVM) 資料，每個 JVM 作用中的處理程序每個間隔一筆記錄。 |
| `QAPMLAPD` | 包括 ISDN LAPD 檔案項目，並列出 LAPD 檔案中的欄位。 |
| `QAPMLINK` | 報告 RDMA 鏈結效能資料，每個間隔每條鏈結一筆記錄。 |
| `QAPMLIOP` | 包括雙軸 IOP 資料檔項目，並列出雙軸 IOP 資料檔中的欄位。 |
| `QAPMLPARH` | 包含 Hypervisor 已知的邏輯分割區配置及使用率資料。 |
| `QAPMMIOP` | 包括多功能 IOP 檔案項目，並列出多功能 IOP 檔案中的欄位。 |
| `QAPMNRG` | 報告網路備用群組 (NRG) 效能資料，每個間隔每個 NRG 一筆記錄。 |
| `QAPMNRGL` | 報告網路備援群組中 RDMA 鏈結的相關資訊，每個間隔每個群組每條鏈結一筆記錄。 |
| `QAPMPOOL` / `QAPMPOOLL` | 提供 `QAPMPOOLL` 以容許「資料收集服務」與效能監視器之間的相容性；`QAPMPOOL` 由 `CVTPFRCOL` 轉換舊版資料時建立，「資料收集服務」本身不建立。 |
| `QAPMPOOLB` | 包括主儲存區檔案項目，並列出系統儲存區的計數器。 |
| `QAPMPOOLT` | 包括主要儲存區檔案項目，並列出儲存區的調整資訊。 |
| `QAPMPPP` | 包括「點對點通訊協定 (PPP)」檔案中的欄位。 |
| `QAPMRESP` | 包括本端工作站回應時間檔案項目，包含根據本端工作站控制器內所收集資料的異動資訊。 |
| `QAPMSAP` | 包含服務存取點 (SAP) 檔案項目，並列出 SAP 檔案中的欄位。 |
| `QAPMSHRMP` | 報告共用記憶體儲存區資料。 |
| `QAPMSMCMN` | 包含支援系統監視之通訊協定資料 (`*CMNBASE`) 的彙總度量。 |
| `QAPMSMDSK` | 包含支援系統監視之磁碟資料 (`*DISK`) 的彙總度量。 |
| `QAPMSMHTP` | 包含支援系統監視之 IBM HTTP Server (Apache) 資料 (`*HTTP`) 的彙總度量值。 |
| `QAPMSMJMI` | 包含支援系統監視之工作資料 (`*JOBMI`) 的彙總度量。 |
| `QAPMSMJOS` | 包含支援系統監視之工作資料 (`*JOBOS`) 的彙總度量。 |
| `QAPMSMPOL` | 包含支援系統監視之儲存區資料 (`*POOL`) 的彙總度量。 |
| `QAPMSMSYS` | 包含支援系統監視之系統資料 (`*SYSLVL`) 的彙總度量。 |
| `QAPMSNA` | 定義「系統網路架構 (SNA)」檔案記錄中的欄位。 |
| `QAPMSNADS` | 定義 SNA 配送服務 (SNADS) 檔案記錄中的欄位。 |
| `QAPMSQLPC` | 包含 `*SQL` 種類所收集「SQL 計劃快取」的效能資料。 |
| `QAPMSTND` | 包括 FDDI 工作站檔案登錄。 |
| `QAPMSTNE` | 包括乙太網路工作站檔案項目，並列出乙太網路工作站檔案中的欄位。 |
| `QAPMSTNL` | 包括記號環工作站檔案登錄，並列出記號環 LAN 工作站檔案中的欄位。 |
| `QAPMSTNY` | 包括訊框中繼站檔案項目，並列出訊框中繼站檔案中的欄位。 |
| `QAPMSYS` / `QAPMSYSL` | 使用 `CVTPFRCOL` 將效能監視器資料庫檔案移轉至較新版次時建立的相容性檔案。 |
| `QAPMSYSCPU` | 報告虛擬處理器裝置的使用率。 |
| `QAPMSYSPRC` | 根據 Hypervisor 資料，報告系統實體處理器裝置的使用率，每個間隔每顆處理器一筆記錄。 |
| `QAPMSYSTEM` | 報告系統層面的效能資料。（已用於 LPAR CPU 容量計算，見 `field_reference.md`） |
| `QAPMSYSVP` | 報告分割區虛擬處理器的已檢測資料，每個間隔每顆處理器一筆記錄。 |
| `QAPMSYSWLC` | 報告工作量群組資料。 |
| `QAPMTAPE` | 包含 `*RMVSTG` 種類收集的磁帶機資料。 |
| `QAPMTCP` | 包含系統層面 TCP/IP 資料。 |
| `QAPMTCPIFC` | 包含與個別 TCP/IP 介面相關的 TCP/IP 資料。 |
| `QAPMUSRTNS` | 包含使用者定義及「應用程式回應測量 (ARM)」異動的效能資料。 |
| `QAPMWASAPP` | 包含在 IBM WebSphere Application Server 上執行之應用程式的相關資訊。 |
| `QAPMWASCFG` | 包含不同伺服器工作的相關配置資訊。 |
| `QAPMWASEJB` | 包含在 IBM WebSphere Application Server 上執行 EJB 的應用程式相關資訊。 |
| `QAPMWASRSC` | 包含與 IBM WebSphere Application Server 相關聯之聯合排存資源的相關資訊。 |
| `QAPMWASSVR` | 包含在 IBM WebSphere Application Server 上執行之伺服器工作的相關資訊。 |
| `QAPMX25` | 包括 X.25 檔案登錄，並列出 X.25 檔案中的欄位。 |
