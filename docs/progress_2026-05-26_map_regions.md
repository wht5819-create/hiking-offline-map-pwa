# 2026-05-26 地圖分區

## 本次完成

| 項目 | 狀態 | 說明 | 為什麼重要 |
|---|---|---|---|
| 分區選擇 | 完成 | 地圖工具抽屜可選示範區、北部、中部、南部、東部、全台 | 讓使用者先以區域理解圖資，不必一開始面對全台檔案 |
| 分區視野 | 完成 | 選北中南東或全台後，地圖會切到對應台灣範圍 | 後續匯入區域 MBTiles 時，操作邏輯更接近實際使用 |
| 分區提示 | 完成 | 每個分區會提示建議離線檔名，如 `rudy-north.mbtiles` | 降低下載與匯入圖資時的命名混亂 |
| 分區檔案 | 完成 | 已整理到 `web_pwa/maps/`，包含北中南東與全台 `.mbtiles` | 手機分區按鈕可直接載入對應離線底圖 |
| 快取升版 | 完成 | Service Worker 升到 `hiking-pwa-v23` | 手機重新整理後可取得新版分區介面 |
| Firebase 發布 | 完成 | 已部署到 `https://my-tools-8ac95.web.app` | 手機可直接測試新版功能 |

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/smoke_test.mjs` | 通過 |
| `npm run smoke` | 通過 |
| Firebase 首頁 | 200，包含 `regionStatus` 與 `app.js?v=23` |
| Firebase Service Worker | 200，包含 `hiking-pwa-v23` |
| Firebase 分區 MBTiles | 北部、中部、南部、東部、全台皆 200 |

## 分區檔案

| 分區 | 檔案 | 大小 |
|---|---|---|
| 北部 | `web_pwa/maps/rudy-north.mbtiles` | 99,667,968 bytes |
| 中部 | `web_pwa/maps/rudy-central.mbtiles` | 141,398,016 bytes |
| 南部 | `web_pwa/maps/rudy-south.mbtiles` | 146,014,208 bytes |
| 東部 | `web_pwa/maps/rudy-east.mbtiles` | 127,418,368 bytes |
| 全台 | `web_pwa/maps/rudy-taiwan.mbtiles` | 509,022,208 bytes |

## Firebase 公開檔案

| 分區 | URL |
|---|---|
| 北部 | `https://my-tools-8ac95.web.app/maps/rudy-north.mbtiles` |
| 中部 | `https://my-tools-8ac95.web.app/maps/rudy-central.mbtiles` |
| 南部 | `https://my-tools-8ac95.web.app/maps/rudy-south.mbtiles` |
| 東部 | `https://my-tools-8ac95.web.app/maps/rudy-east.mbtiles` |
| 全台 | `https://my-tools-8ac95.web.app/maps/rudy-taiwan.mbtiles` |

## 手機測試

1. 開啟 `https://my-tools-8ac95.web.app`
2. 若看不到新版，先重新整理一次
3. 點右上選單，選「北部 / 中部 / 南部 / 東部 / 全台」
4. 看左下狀態文字與圖資區塊是否顯示對應分區

## 下一步

1. 將真實 Rudy Map 依分區切成 `rudy-north.mbtiles` 等檔案。
2. 加入分區檔下載連結或 QR code，讓手機可直接下載再匯入。
