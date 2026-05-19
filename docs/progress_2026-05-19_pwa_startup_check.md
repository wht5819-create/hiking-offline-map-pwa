# 2026-05-19 進度：PWA 出發檢查

## 本次完成

| 項目 | 狀態 | 說明 |
|---|---|---|
| PWA 出發檢查 | 已完成 | 首頁新增 HTTPS、離線快取、GPX、定位四項狀態 |
| 狀態即時更新 | 已完成 | GPX 匯入、GPS 取得位置、Service Worker 註冊後會更新檢查狀態 |
| 快取版本 | 已更新 | `sw.js` 快取版本由 `hiking-pwa-v1` 更新為 `hiking-pwa-v2` |
| 文件同步 | 已完成 | README、MVP 狀態、下一步文件已更新 |

## 已驗證

| 驗證 | 結果 |
|---|---|
| `node --check web_pwa/app.js` | 通過 |
| `node --check web_pwa/sw.js` | 通過 |
| `node --check web_pwa/server.js` | 通過 |
| 本機 HTTP 回應 | `/`、`/sw.js`、`/sample/demo-route.gpx` 均回 200 |

## 尚未完成

| 項目 | 原因 | 下一步 |
|---|---|---|
| HTTPS production 部署 | 已建立 Netlify 站台，但 production deploy 被帳號額度擋下：`Skipped due to account credit usage exceeded` | 已改準備 GitHub Pages 發布設定 |
| 手機實機安裝測試 | 仍需要 HTTPS 網址 | 部署後用 Android Chrome / iPhone Safari 加入主畫面 |
| 視覺截圖驗證 | 本機 Chrome/Edge headless 在此環境會崩潰 | 可在一般桌面瀏覽器或部署後用手機檢查 |
| GitHub Pages 推送 | 公開 GitHub repo 建立被安全審核擋下，因目前工作區含完整公司專案內容 | 建議改成只公開 `web_pwa/` 靜態 PWA；需使用者明確同意公開發布 |

## Netlify 狀態

| 欄位 | 內容 |
|---|---|
| Site name | `hiking-offline-map-pwa` |
| Site id | `31e83ced-12b2-4ed1-b45b-1319b09457a3` |
| 預期 HTTPS 網址 | `https://hiking-offline-map-pwa.netlify.app` |
| Deploy id | `6a0bd4f194a2e7b4d3c6d806` |
| Deploy 狀態 | `error` / skipped |
| 阻塞原因 | Netlify 帳號 credit usage exceeded |
| HTTPS 實測 | 尚不可用，連線無法建立 SSL |

## 下次接續建議

1. 若繼續使用 Netlify：恢復帳號額度後，重送 `web_pwa/` production deploy 到 site id `31e83ced-12b2-4ed1-b45b-1319b09457a3`。
2. 若要避開 Netlify 額度：建立只含 `web_pwa/` 的公開 GitHub Pages repo，避免整個公司專案公開。
3. 部署成功後，用手機開啟 HTTPS 網址，確認「出發檢查」四項狀態會依序變更。
