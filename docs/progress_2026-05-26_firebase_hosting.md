# 2026-05-26 Firebase Hosting 部署

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| Firebase Hosting 設定 | 完成 | 新增 `.firebaserc` 與 `firebase.json`，指定專案 `my-tools-8ac95`，發布資料夾為 `web_pwa` | 讓手機可直接用 HTTPS 開啟 PWA，不受同 Wi-Fi / 熱點反向連線限制 |
| 靜態檔排除規則 | 完成 | 部署排除 log、server 腳本、README、package 檔 | 降低外部發布範圍，只保留 PWA 執行必要檔案 |
| Firebase 部署 | 完成 | 發布到 `https://my-tools-8ac95.web.app` | 可在手機行動網路直接測試安裝、離線快取、GPX 與定位 |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `npm run smoke` | 通過 |
| `https://my-tools-8ac95.web.app/` | 200 |
| `https://my-tools-8ac95.web.app/sample/demo-route.gpx` | 200，930 bytes |
| `https://my-tools-8ac95.web.app/sample/rudy-route-z12-z16.mbtiles` | 200，5,287,936 bytes |

## 手機測試

1. 手機開啟 `https://my-tools-8ac95.web.app`
2. 點中央播放鍵載入示範
3. 確認魯地圖底圖與 GPX 航跡疊合
4. Android Chrome 可從選單加入主畫面；iPhone Safari 可從分享加入主畫面

## 下一步

1. 手機實測 GPS 定位與偏離警報。
2. 若展示流程穩定，下一步做「依 GPX 自動打包 MBTiles」。
