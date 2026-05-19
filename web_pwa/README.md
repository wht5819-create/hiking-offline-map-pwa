# 登山離線地圖 PWA

這是手機可安裝的網頁版 MVP，與 Flutter 原生版分開維護。

## 功能

- 可加入手機主畫面
- Service Worker 快取 App shell，開過一次後可離線開啟
- GPX 匯入與航點列表
- GPS 定位
- 每 10 秒或移動超過 10 公尺才更新偏離判斷
- 距離 GPX 路線超過 50 公尺時提示並嘗試震動

## 本機預覽

```powershell
node server.js
```

開啟：

```text
http://localhost:4173
```

可用 `sample/demo-route.gpx` 測試 GPX 匯入。

## 手機安裝條件

正式手機安裝需要 HTTPS 網址。部署到 Netlify、Firebase Hosting、GitHub Pages 或公司內部 HTTPS 主機後：

- Android Chrome：右上選單 -> 加入主畫面
- iPhone Safari：分享 -> 加入主畫面

## 與 Flutter 版差異

純網頁版目前不讀取 `.mbtiles` SQLite 地圖包；瀏覽器端要完整支援 MBTiles 需要 WASM SQLite 與大量檔案快取策略。此版先完成可安裝、GPX、GPS 與偏離警報。
