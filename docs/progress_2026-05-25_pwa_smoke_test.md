# 2026-05-25 PWA Smoke Test

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| Demo 資源檢查 | 完成 | 新增 `web_pwa/smoke_test.mjs`，自動檢查首頁、範例 GPX、Service Worker、範例 MBTiles | 展示前可快速確認「載入示範」所需檔案都可用 |
| npm 指令 | 完成 | `web_pwa/package.json` 新增 `npm run smoke` | 非技術使用者也能用固定指令驗證 PWA 狀態 |
| 本機服務驗證 | 完成 | Smoke test 會啟動 `server.js`，再用 `127.0.0.1:4173` 抓取檔案 | 避免只做靜態語法檢查，卻漏掉部署路徑或檔案缺漏 |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/server.js` | 通過 |
| `node --check web_pwa/smoke_test.mjs` | 通過 |
| `npm run smoke` | 通過；首頁、GPX、Service Worker、MBTiles 均回傳 200 |

## 注意事項

- Codex 內建瀏覽器目前會阻擋 `localhost` / `127.0.0.1`，因此尚未完成視覺截圖驗證。
- Smoke test 已確認 Demo 必要資源存在，但不能取代手機上安裝、離線、GPS 權限與 Canvas 視覺檢查。

## 下一步

1. 用手機 HTTPS 網址開啟 PWA，點播放鍵確認魯地圖底圖與 GPX 航跡疊合。
2. 若手機畫面可接受，下一步做「依 GPX 自動打包 MBTiles」流程。
3. 若要進原生 App，回到 Flutter P0：補完整 Android/iOS 平台目錄與定位權限。
