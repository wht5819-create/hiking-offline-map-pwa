# 登山離線地圖 PWA

這是手機可安裝的網頁版 MVP，與 Flutter 原生版分開維護。

## 功能

- 可加入手機主畫面
- Service Worker 快取 App shell，開過一次後可離線開啟
- 可先匯入魯地圖 `.map` 或 `.mbtiles` 圖資，讀取圖資 metadata
- 可用線上 OpenTopoMap 地形圖作為可見底圖，已瀏覽圖磚會被 Service Worker 快取
- Raster MBTiles 可嘗試作為 Canvas 底圖；Vector PBF 目前先完成匯入辨識，尚未渲染
- Mapsforge `.map` 可先匯入辨識範圍；完整向量渲染仍需後續接渲染管線
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

純網頁版已可讀取 `.mbtiles` metadata，並可嘗試渲染 raster 圖磚。魯地圖常見的 Mapsforge `.map` 可先匯入辨識；目前可見底圖先使用線上 OpenTopoMap 圖磚，完整魯地圖 `.map` 渲染仍需要 Mapsforge/MapLibre vector style pipeline。
