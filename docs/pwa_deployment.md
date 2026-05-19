# PWA 部署與手機安裝

## 已完成

`web_pwa/` 是可部署的靜態 PWA，不需要 Flutter SDK，也不需要 build step。

包含：

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `assets/icon-192.png`
- `assets/icon-512.png`
- 魯地圖 `.map` / `.mbtiles` 匯入與 metadata 讀取
- GPX 匯入、GPS 定位、偏離 50 公尺提醒

## 本機預覽

```powershell
cd web_pwa
npm start
```

開啟：

```text
http://localhost:4173
```

可用 `web_pwa/sample/demo-route.gpx` 測試 GPX 匯入。

localhost 可以測 service worker；手機正式安裝仍建議使用 HTTPS。

## Netlify

根目錄已加入 `netlify.toml`，設定如下：

- publish directory：`web_pwa`
- build command：空白
- `sw.js` 不快取
- `manifest.webmanifest` 設定正確 MIME type

部署後，用手機打開 Netlify HTTPS 網址即可安裝。

## GitHub Pages

已加入 `.github/workflows/pages.yml`，會在 `main` 分支 push 後自動將 `web_pwa/` 發布到 GitHub Pages。

設定重點：

- Pages 來源：GitHub Actions
- 發布資料夾：`web_pwa`
- build step：無
- `.nojekyll`：已放在 `web_pwa/`，避免靜態檔案被 Jekyll 處理

## 手機安裝方式

| 平台 | 操作 |
|---|---|
| Android Chrome | 開啟 HTTPS 網址 -> 右上選單 -> 加入主畫面 / 安裝應用程式 |
| iPhone Safari | 開啟 HTTPS 網址 -> 分享 -> 加入主畫面 |

## 限制

純網頁版已透過 `sql.js` 讀取 `.mbtiles`，raster 圖磚可嘗試在 Canvas 顯示。魯地圖常見的 Mapsforge `.map` 可先匯入辨識；完整渲染仍需要 Mapsforge/MapLibre vector style pipeline。目前 PWA 先完成匯入辨識、GPX、GPS 與偏離警報。
