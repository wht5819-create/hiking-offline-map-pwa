# 實作注意事項

## 離線地圖

- Rudy Map 的 Style JSON 建議使用 `{{TILE_URL_TEMPLATE}}` 作為向量 source 的 `tiles` URL，執行時會替換成 `http://127.0.0.1:<port>/tiles/{z}/{x}/{y}.pbf`。
- App 會用 `MbtilesTileServer` 開啟 `.mbtiles` SQLite，將 MapLibre 的 XYZ y 座標轉成 MBTiles TMS y 座標後讀取 `tiles.tile_data`。
- Vector tile 若已 gzip 壓縮，server 會保留原始 bytes 並加上 `Content-Encoding: gzip`。
- 圖層開關依賴 style layer id。若 Rudy Map 實際 layer id 與範例不同，請在 `OfflineMapView.contourLayerIds` 與 `traditionalRoadLayerIds` 傳入實際清單。
- MapLibre 官方文件說明 `styleString` 可使用 raw JSON、本地檔案或 asset；glyph/sprite 離線資源仍需放在 app 可讀取位置。

## GPX

- `GpxParser.parseFile()` 會解析 `<trkpt lat="" lon="">`、`<ele>`、`<wpt>`、`<name>`。
- `ParsedGpx.toRouteLineOptions()` 可直接交給 `MapLibreMapController.addLine()` 畫航跡。
- `GpxImportPage` 已串接檔案選擇器，匯入後會回傳 `ParsedGpx` 給主畫面，並送入地圖頁疊線。
- 大型 GPX 未來可改成 streaming parser，避免一次載入過大 XML。

## MBTiles 管理

- `MbtilesLocalDataSource` 會先驗證副檔名與 SQLite 檔頭，再複製到 app support directory 的 `offline_maps` 目錄。
- 匯入時若同名檔案已存在，會自動加上 `-2`、`-3`，避免覆蓋使用者既有地圖包。
- `MbtilesManagementPage` 已提供匯入、選擇、重新整理與刪除的基本流程。
- 目前先做檔案層管理；若要讀取 MBTiles metadata、bounds、minzoom、maxzoom，下一步可加入 `sqflite` 或 `sqlite3_flutter_libs`。

## GPS 偏離航線

- `RouteDeviationService` 預設超過 50 公尺觸發 `onOffRoute`。
- Android 使用 `AndroidSettings(intervalDuration: 10 秒, distanceFilter: 10 公尺)`；iOS 使用 `AppleSettings(distanceFilter: 10 公尺)`。
- 路線距離以每一段 GPX 線段計算最近投影點；短距離山徑場景下比逐點比對更準，運算量仍為 O(n)。
- 核心計算已抽到 `RouteDistanceCalculator`，不用啟動 GPS 也能單元測試。

## 待補實機設定

- Android：`ACCESS_FINE_LOCATION`、`ACCESS_COARSE_LOCATION`；若要真正背景定位，需補 foreground service 設定。
- iOS：`NSLocationWhenInUseUsageDescription`；如需背景定位需額外開 Background Modes。
- Android 讀取 `Download/` 的 `.mbtiles` 在新版本系統上通常應透過檔案選擇器或 app 專屬資料夾處理，避免儲存權限問題。
