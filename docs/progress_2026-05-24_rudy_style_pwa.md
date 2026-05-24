# 2026-05-24 Rudy 風格 PWA 改版

## 本次完成

| 項目 | 狀態 | 說明 | 策略影響 |
|---|---|---|---|
| 地圖首屏改版 | 完成 | 首頁改為地圖優先，加入 GPS pill、搜尋、選單、安全浮動按鈕 | 更接近 OruxMaps / 魯地圖使用情境，降低使用者認知落差 |
| Rudy 風格底圖預覽 | 完成 | 未匯入 MBTiles 時，Canvas 先畫出綠色地形、等高線、水線、道路與山徑感 | 在沒有真實圖磚時仍可展示產品方向 |
| 航跡視覺調整 | 完成 | GPX 路線改為橘色主線、藍色航點，接近參考截圖 | 路線辨識度更高，符合登山 APP 直覺 |
| 匯入入口改名 | 完成 | 檔案按鈕改為「匯入魯地圖 MBTiles」 | 明確引導使用者匯入可渲染的 raster `.mbtiles` |
| 一鍵範例魯地圖 | 完成 | 新增「範例魯地圖」按鈕，載入 `web_pwa/sample/rudy-route-z12-z16.mbtiles` | 可直接驗證真實 raster 底圖，不必先手動選檔 |
| 離線快取升版 | 完成 | Service Worker 更新為 `hiking-pwa-v14` | 確保手機端刷新後取得新版介面 |

## 技術路線

目前選擇：**Rudy `.map` 先預轉 raster MBTiles，再由 PWA 匯入顯示**。

原因：

- PWA 直接完整渲染 Mapsforge `.map` + Rudy Style 成本高，且瀏覽器端缺乏成熟穩定方案。
- 專案已有 `tools/convert_rudy_map_to_mbtiles.ps1` 與測試 `.mbtiles`，可先走可驗證路線。
- 使用者要的是手機上像截圖那樣的「可看、可定位、可離線」體驗，raster MBTiles 最快能達成。

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/server.js` | 通過 |
| 介面關鍵字 | 已包含 `Rudy style PWA`、`匯入魯地圖 MBTiles`、`範例魯地圖` |
| 範例 MBTiles | `http://localhost:4173/sample/rudy-route-z12-z16.mbtiles` 回傳 200，大小 5,287,936 bytes |

## 下一步

1. 在手機 PWA 依序點「範例魯地圖」與「範例路線」，確認真實 raster 底圖與橘色航跡疊合。
2. 選一條實際 GPX，執行 `tools/convert_rudy_map_to_mbtiles.ps1 -Gpx <路線.gpx> -Output tiles/<route>.mbtiles -MinZoom 12 -MaxZoom 16`。
3. 若可接受，再做「依 GPX 自動打包 MBTiles」流程，讓使用者不用手動理解轉圖。
