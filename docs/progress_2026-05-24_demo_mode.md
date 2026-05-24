# 2026-05-24 PWA Demo 模式更新

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| Demo URL 自動載入 | 完成 | 開啟 `/?demo=1` 或 `/#demo` 時，自動載入範例魯地圖 MBTiles 與範例 GPX | 展示或手機試用時不用先教使用者按哪個按鈕，降低首次體驗摩擦 |
| 示範按鈕狀態 | 完成 | 範例載入中會暫停按鈕並改變按鈕狀態 | 避免重複點擊造成多次讀取 5MB 圖資 |
| 快取升版 | 完成 | Service Worker 更新為 `hiking-pwa-v21`，HTML 引用更新為 `app.js?v=21` / `styles.css?v=21` | 確保手機刷新後拿到 Demo 模式新版 |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/server.js` | 通過 |
| `http://127.0.0.1:4173/?demo=1` | 200 |
| `http://127.0.0.1:4173/app.js?v=21` | 200，包含 `demoModeRequested` |
| `http://127.0.0.1:4173/sw.js` | 200 |
| `http://127.0.0.1:4173/sample/demo-route.gpx` | 200 |
| `http://127.0.0.1:4173/sample/rudy-route-z12-z16.mbtiles` | 200，大小 5,287,936 bytes |

## 注意事項

- Codex 內建瀏覽器仍回報 localhost 被擋，因此本次尚未完成實際畫面截圖。
- 若要手機試用，建議部署或開 HTTPS tunnel 後直接打開 `/?demo=1`。

## 下一步

1. 用一般瀏覽器或手機 HTTPS 網址開 `/?demo=1`，確認畫面自動顯示魯地圖底圖與 GPX 航跡。
2. 若展示速度太慢，把 `sql.js` 與 wasm 改為本機 vendor 檔，避免依賴 CDN。
3. 下一階段可做「依 GPX 自動打包 MBTiles」入口，讓使用者不用理解轉圖流程。
