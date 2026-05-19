# 魯地圖 .map 轉成網頁圖磚

## 結論

魯地圖 `MOI_OSM_Taiwan_TOPO_Rudy.map` 是 Mapsforge 向量地圖，手機網頁無法直接完整渲染。正確做法是在電腦先轉成 raster `MBTiles`，再匯入 PWA。PWA 目前已支援 raster `.mbtiles`。

## 先做小範圍測試

在專案根目錄執行：

```powershell
.\tools\convert_rudy_map_to_mbtiles.ps1
```

如果目前命令列不在專案根目錄，請先切換：

```powershell
cd "C:\Users\881025\OneDrive - Digital Kingstone Co.,Ltd\claude專案\登山APP"
```

預設會輸出：

```text
tiles\rudy-test.mbtiles
```

這個預設範圍是台北小區塊，倍率 `12-14`，用途是確認渲染流程和手機 PWA 匯入可用。

目前已在本機驗證：小範圍測試產出 `132` 張圖磚，檔案約 `11 MB`，並可抽出 PNG 圖磚。

也已產出較清楚的台北測試檔：

```text
tiles\rudy-taipei-z12-z16.mbtiles
```

這個檔案倍率 `12-16`，共 `1769` 張圖磚，約 `101 MB`。

## 用 GPX 路線周邊轉圖磚

這是正式登山使用建議方式。把 GPX 放到專案資料夾後執行：

```powershell
.\tools\convert_rudy_map_to_mbtiles.ps1 `
  -Gpx ".\你的路線.gpx" `
  -Output ".\tiles\route-z12-z16.mbtiles" `
  -MinZoom 12 `
  -MaxZoom 16 `
  -GpxBuffer 0.03
```

`GpxBuffer 0.03` 大約是在路線外圍多留 3 公里左右，避免走偏時沒有底圖。

GPX 可以使用完整路徑，例如：

```powershell
.\tools\convert_rudy_map_to_mbtiles.ps1 `
  -Gpx "G:\我的雲端硬碟\雪山主峰｜雪主東_Joyhike.gpx" `
  -Output ".\tiles\route-z12-z16.mbtiles" `
  -MinZoom 12 `
  -MaxZoom 16
```

## 轉整個台灣

確認小測試可用後，再轉整個魯地圖範圍：

```powershell
.\tools\convert_rudy_map_to_mbtiles.ps1 `
  -Output ".\tiles\rudy-taiwan-z10-z14.mbtiles" `
  -Bbox "118,20.62439,123.0348,26.70665" `
  -MinZoom 10 `
  -MaxZoom 14 `
  -MaxTiles 0
```

`MaxZoom` 越高檔案會快速變大。建議先做到 `14`，確認路線閱讀性後再評估 `15`。

## 使用方式

1. 轉出 `.mbtiles`。
2. 手機開 PWA。
3. 按「匯入魯地圖」。
4. 選擇產出的 `.mbtiles`。
5. 匯入 GPX 航跡。

如果手機檔案選擇器沒有保留 `.mbtiles` 副檔名，新版 PWA 會改用檔案內容辨識 SQLite MBTiles；仍失敗時，請把檔名改回 `rudy-test.mbtiles` 再選一次。

## 需要的執行環境

工具會優先使用本機 `Java 17 + Maven`。如果沒有 Java，會改用 Docker 的 `maven:3.9-eclipse-temurin-21` 容器。

目前這台電腦之前檢查到本機沒有 Java，Docker 指令存在，但 Docker Desktop 需要先啟動完成。
