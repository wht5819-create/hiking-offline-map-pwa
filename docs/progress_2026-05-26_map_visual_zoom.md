# 2026-05-26 底圖清晰度與縮放

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| 底圖視覺 | 完成 | 調整 fallback 地形底圖為較清楚的綠地、等高線、河流、道路與山徑風格 | 手機未完全載入圖磚時仍有接近登山圖的視覺辨識 |
| Raster 清晰度 | 完成 | MBTiles 圖磚套用較高對比、飽和與亮度 | 讓魯地圖底圖在手機上更接近截圖那種清楚地圖感 |
| 縮放控制 | 完成 | 新增右側 `+ / -` 按鈕 | 不必只靠雙指手勢，單手也能放大縮小 |
| 觸控縮放 | 完成 | Canvas 支援雙指縮放，並使用 `requestAnimationFrame` 重繪 | 放大縮小較順，不會每個觸控事件都硬重畫 |
| 快取升版 | 完成 | 更新到 `hiking-pwa-v32`，`fresh.html` 會導向 `?v=32` | 手機可清掉舊版快取後取得新版 |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `npm run smoke` | 通過 |
| Firebase 首頁 | 200，包含 `app.js?v=32`、`styles.css?v=32` 與縮放按鈕 |
| Firebase Service Worker | 200，包含 `hiking-pwa-v32` |

## 手機測試

1. 開啟 `https://my-tools-8ac95.web.app/fresh.html`
2. 等它跳到新版
3. 測試右側 `+ / -`
4. 測試雙指縮放
5. 先用北部分區測試，避免全台檔過大造成等待
