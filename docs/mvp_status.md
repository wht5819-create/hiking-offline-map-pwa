# MVP 狀態

## MVP 已包含

| 功能 | 狀態 | 使用流程 | 對使用者的重要性 |
|---|---|---|---|
| 離線地圖包匯入 | 已完成基本版 | 地圖包頁匯入 `.mbtiles`，App 複製到管理目錄 | 上山前可先準備離線地圖 |
| Rudy Map Style | 已完成基本版 | 預設使用內建 template，也可選擇自訂 JSON | 能渲染等高線與路網圖層 |
| 地圖顯示 | 已完成基本版 | 選擇地圖包後，App 會啟動 localhost tile server 給 MapLibre 讀取 | 形成離線導航主畫面 |
| GPX 匯入 | 已完成基本版 | GPX 頁選擇 `.gpx`，顯示軌跡與航點摘要 | 可載入前人航跡作為路線指引 |
| GPX 疊線 | 已完成基本版 | 匯入 GPX 後自動回地圖頁，橘色線段疊在地圖上 | 可看見預計路線 |
| 等高線 / 傳統路網開關 | 已完成基本版 | 地圖頁右上角按鈕切換 layer visibility | 登山時可依需求簡化圖面 |
| GPS 定位 | 已完成基本版 | 地圖頁使用 MapLibre my location 與 geolocator | 可看到目前位置 |
| 偏離航線警報 | 已完成基本版 | 匯入 GPX 後，地圖頁右上角 GPS 按鈕啟動 | 超過 50 公尺可提示，降低迷路風險 |
| PWA 出發檢查 | 已完成基本版 | 首頁顯示 HTTPS、離線快取、GPX、定位四項狀態 | 出發前可快速確認手機端是否已具備最低可用條件 |
| WGS84 轉 TWD97 | 已有核心工具 | `Twd97Converter` 可供座標顯示或後續搜尋使用 | 台灣山域常見座標系統支援 |

## MVP 尚未保證

| 限制 | 原因 | 建議處理 |
|---|---|---|
| 尚未實機編譯驗證 | 目前環境沒有 Flutter SDK | 在有 Flutter 的電腦執行 `flutter pub get`、`flutter analyze`、`flutter test` |
| 尚未建立完整 Android/iOS 平台目錄 | 目前不是 Flutter CLI 產生的完整專案 | 執行 `flutter create .` 補平台目錄後再保留現有 `lib/` 與 `pubspec.yaml` |
| localhost tile server 需實機確認 | 已改用 App 內建 server，但仍需確認 Android/iOS 允許 MapLibre 讀 `127.0.0.1` | 若失敗，需補平台網路安全設定或原生 protocol handler |
| 後台定位尚未完成平台設定 | Android/iOS 都需要額外權限與背景服務設定 | 補 Manifest、Info.plist、foreground service |
| Style layer id 需對齊實際 Rudy Map | 不同 Rudy Map build 的 layer id 可能不同 | 用實際 style JSON 修正 layer id 清單 |

## 最小可用驗收路徑

1. 安裝 Flutter SDK。
2. 在專案根目錄執行 `powershell -ExecutionPolicy Bypass -File tools/bootstrap_flutter_project.ps1` 產生平台目錄並跑檢查。
3. 依 `docs/platform_setup.md` 補 Android/iOS 權限。
4. 用 Android 實機安裝。
5. 在地圖包頁匯入 `taiwan.mbtiles`。
6. 如內建 template 不符合實際 Rudy Map layer，選擇 Rudy Map 的 style JSON。
7. 在 GPX 頁匯入一條測試航跡。
8. 回到地圖頁確認 localhost tile server 啟動、地圖、航跡、定位點都顯示。
9. 按 GPS 警報按鈕，確認 50 公尺偏離提示能觸發。
