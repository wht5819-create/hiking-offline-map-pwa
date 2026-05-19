# 2026-05-18 收工紀錄：登山 App PWA 版

## 今日完成

| 項目 | 狀態 | 說明 |
|---|---|---|
| PWA 網頁版 | 已完成基本版 | 建立於 `web_pwa/`，可作為手機安裝用靜態網站 |
| 手機安裝設定 | 已完成 | 已加入 `manifest.webmanifest`、`sw.js`、192/512 PNG icon、Apple mobile web app meta |
| GPX 匯入 | 已完成 | 可選 `.gpx`，解析 `trkpt` 與 `wpt` |
| 航跡繪製 | 已完成 | 使用 Canvas 繪製航跡與等高線風格背景 |
| GPS 定位 | 已完成 | 使用 browser geolocation |
| 偏離航線警報 | 已完成 | 每 10 秒或移動超過 10 公尺更新；偏離 50 公尺以上提示並嘗試震動 |
| 離線快取 | 已完成基本版 | Service Worker 快取 app shell |
| 測試 GPX | 已完成 | `web_pwa/sample/demo-route.gpx` |
| Netlify 設定 | 已完成 | `netlify.toml`、`web_pwa/_headers`、`.nojekyll` |

## 已驗證

| 驗證 | 結果 |
|---|---|
| `node --check app.js` | 通過 |
| `node --check sw.js` | 通過 |
| `node --check server.js` | 通過 |
| 本機 HTTP 回應 | `/`、`/manifest.webmanifest`、`/sw.js`、`/assets/icon-192.png`、`/sample/demo-route.gpx` 均回 200 |

## 尚未完成

| 項目 | 原因 | 下一步 |
|---|---|---|
| HTTPS 網址部署 | Netlify 外掛 token 已過期；Netlify CLI 透過 npm 下載 / 安裝時多次逾時或卡住 | 重新登入 Netlify 外掛或在可正常 npm 安裝的環境執行部署 |
| 手機實機安裝測試 | 尚未取得 HTTPS 網址 | 部署成功後，用 Android Chrome / iPhone Safari 加入主畫面 |

## 目前可用檔案

- `web_pwa/index.html`
- `web_pwa/app.js`
- `web_pwa/styles.css`
- `web_pwa/manifest.webmanifest`
- `web_pwa/sw.js`
- `web_pwa/assets/icon-192.png`
- `web_pwa/assets/icon-512.png`
- `web_pwa/sample/demo-route.gpx`
- `docs/pwa_deployment.md`
- `netlify.toml`

## 下次接續建議

1. 先處理 Netlify 登入：重新授權 Netlify 外掛，或本機執行 `npx netlify login`。
2. 部署 production：`netlify deploy --prod --dir web_pwa` 或使用既有 `netlify.toml`。
3. 取得 HTTPS 網址後，用手機測試加入主畫面。
4. 匯入 `demo-route.gpx`，測試 GPS 權限與偏離警報。
