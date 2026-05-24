# 下一步建議

| 優先順序 | 工作 | 目的 | 影響 |
|---|---|---|---|
| P0 | 用 Flutter CLI 重新產生完整 `android/ios` 平台目錄 | 目前只有 app 程式碼骨架，還不是完整可安裝專案 | 這是進入實機測試的前置條件 |
| P0 | 補 Android/iOS 定位與檔案權限 | 讓 GPS、背景定位、MBTiles 匯入能在手機運作 | 直接影響登山安全與離線可用性 |
| P0 | 實機驗證 localhost tile server | 確認 MapLibre 可讀 `http://127.0.0.1:<port>/tiles/{z}/{x}/{y}.pbf` | 若不可用，要補平台網路安全設定或原生 protocol handler |
| P1 | 串接 GPX 匯入 UI 與航跡疊圖 | 已完成基本版：可選 GPX、解析摘要、傳回地圖疊線 | 待 Flutter 實機驗證 MapLibre 疊線 API |
| P1 | 建立 MBTiles 管理頁 | 已完成基本版：列出、匯入、選擇、刪除離線地圖包 | 待實機驗證檔案選擇器與 app support directory |
| P1 | Style JSON 管理 | 已完成基本版：內建 template，也可選擇自訂 JSON | 待用實際 Rudy Map style 修正 layer id |
| P1 | 偏離航線警報 UI | 已完成基本版：地圖頁可啟動 GPS 追蹤，超過 50 公尺提示 | 待實機驗證背景定位與省電表現 |
| P1 | 首次啟動導引 | PWA 已加入「出發檢查」，可即時顯示 HTTPS、離線快取、GPX、定位狀態 | 降低非技術使用者設定門檻 |
| P1 | Demo 模式 | 已完成基本版：開 `/?demo=1` 或 `/#demo` 自動載入範例魯地圖與 GPX | 降低展示與手機首次試用摩擦 |
| P1 | SQL.js 本機化 | 已完成：`sql-wasm.js` 與 `sql-wasm.wasm` 已納入 PWA 快取 | 減少 CDN 依賴，讓離線 MBTiles 讀取更可靠 |
| P2 | 讀取 MBTiles metadata | 顯示地圖範圍、版本、縮放層級 | 避免使用者載入錯誤地圖 |
| P2 | 加入軌跡記錄與匯出 GPX | 支援登山後回顧與分享 | 提升 App 黏著度 |

## 目前限制

- 這台環境沒有 `flutter` / `dart` 指令，因此尚未跑過 `flutter analyze` 與單元測試。
- `maplibre_gl` 對本地 `.mbtiles` 的 URI 支援需在 Android/iOS 實機確認；若實機不支援直接 `mbtiles://`，需要補原生 protocol handler 或改成本地 tile server。
- `Download/` 讀取在新版 Android 上有儲存權限限制，正式 App 建議用檔案選擇器匯入到 app 專屬資料夾。
