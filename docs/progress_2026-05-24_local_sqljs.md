# 2026-05-24 PWA 本機 SQL.js 更新

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| SQL.js 本機化 | 完成 | 新增 `web_pwa/vendor/sqljs/sql-wasm.js` 與 `sql-wasm.wasm` | Demo 與離線讀 MBTiles 不再依賴 CDN，展示與山區試用更穩 |
| App 載入路徑更新 | 完成 | HTML 改載 `vendor/sqljs/sql-wasm.js?v=22`，App 的 wasm `locateFile` 改成本機路徑 | 避免使用者首次載入時被外部網路品質影響 |
| Service Worker 升版 | 完成 | 快取升到 `hiking-pwa-v22`，並預快取 SQL.js / wasm | 安裝後可保留讀取 MBTiles 的核心能力 |
| wasm MIME type | 完成 | 本機 server 加入 `.wasm` -> `application/wasm` | 避免瀏覽器因 MIME type 不正確而拒絕執行 wasm |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/server.js` | 通過 |
| `http://127.0.0.1:4173/?demo=1` | 200 |
| `http://127.0.0.1:4173/app.js?v=22` | 200，包含本機 `./vendor/sqljs` |
| `http://127.0.0.1:4173/vendor/sqljs/sql-wasm.js?v=22` | 200 |
| `http://127.0.0.1:4173/vendor/sqljs/sql-wasm.wasm` | 200，Content-Type 為 `application/wasm` |
| `http://127.0.0.1:4173/sample/demo-route.gpx` | 200 |
| `http://127.0.0.1:4173/sample/rudy-route-z12-z16.mbtiles` | 200，大小 5,287,936 bytes |

## 下一步

1. 用一般瀏覽器或手機 HTTPS 網址開 `/?demo=1`，確認真實畫面可自動載入底圖與 GPX。
2. 若畫面可接受，下一步做「依 GPX 自動打包 MBTiles」流程。
3. 若要正式發布，檢查 Netlify / GitHub Pages 是否正確提供 `.wasm` MIME type。
