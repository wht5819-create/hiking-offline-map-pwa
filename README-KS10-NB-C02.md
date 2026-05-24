# 登山離線地圖 App

Flutter Clean Architecture 原型，先完成三個安全與體驗核心：

- 離線地圖：MapLibre GL + App 內建 MBTiles tile server + Rudy Map style layer 開關
- GPX：解析 `<trkpt>` 與 `<wpt>`，轉成 MapLibre 可繪製線段
- GPS：10 公尺 / 10 秒定位節流，計算偏離 GPX 路線距離，超過 50 公尺觸發 callback
- MBTiles：匯入、驗證、列出、刪除 app 管理的離線地圖包
- 基本介面：地圖 / GPX / 地圖包三頁籤，GPX 匯入後會傳回地圖疊線
- 手機 PWA：`web_pwa/` 提供可部署到 HTTPS、可加入手機主畫面的網頁版
- PWA 出發檢查：首頁會顯示 HTTPS、離線快取、圖資、GPX、定位五項狀態
- PWA 魯地圖圖資：手機網頁版可先匯入 `.mbtiles`，讀取 metadata；raster MBTiles 會嘗試作為底圖顯示

## 地圖套件選型

本專案先採用 `maplibre_gl`，原因：

- 支援向量圖磚與 Mapbox/MapLibre Style JSON，較符合 Rudy Map 等高線、YPD 路網這類圖層化資料。
- 可透過 `MapLibreMapController.setLayerVisibility()` 動態開關指定圖層。
- `flutter_map` 較適合 raster tile；若要向量 MBTiles，需要再疊第三方 vector tile provider，效能與 style 能力要另行驗證。

## 目前檔案重點

| 檔案 | 用途 |
|---|---|
| `docs/project_structure.md` | Clean Architecture 樹狀結構與職責說明 |
| `docs/mvp_status.md` | MVP 已完成範圍、限制與驗收路徑 |
| `docs/platform_setup.md` | Flutter 平台目錄建立、Android/iOS 權限與實機驗收說明 |
| `docs/pwa_deployment.md` | PWA 部署與手機安裝說明 |
| `tools/bootstrap_flutter_project.ps1` | 在有 Flutter SDK 的電腦產生平台目錄並跑基本檢查 |
| `web_pwa/` | 可安裝到手機主畫面的靜態 PWA 版本 |
| `lib/features/home/presentation/pages/hiking_home_page.dart` | 三頁籤主畫面與狀態串接 |
| `lib/features/offline_map/presentation/widgets/offline_map_view.dart` | 載入本地 `.mbtiles` 與 Style JSON，開關等高線 / 傳統路網 |
| `lib/features/gpx/data/services/gpx_parser.dart` | GPX XML 解析與錯誤處理 |
| `lib/features/gpx/data/models/gpx_models.dart` | GPX 軌跡點、航點、MapLibre 線段轉換 |
| `lib/features/gpx/presentation/pages/gpx_import_page.dart` | GPX 檔案選擇、匯入摘要、航點列表 |
| `lib/features/tracking/data/services/route_deviation_service.dart` | GPS 串流與偏離航線警報 |
| `lib/features/tracking/domain/services/route_distance_calculator.dart` | 可測試的路線偏離距離計算 |
| `lib/features/mbtiles/data/datasources/mbtiles_local_data_source.dart` | `.mbtiles` 本地檔案匯入與驗證 |
| `lib/features/mbtiles/data/services/mbtiles_tile_server.dart` | 從 MBTiles SQLite 讀取圖磚並透過 localhost 供 MapLibre 使用 |
| `lib/features/mbtiles/domain/repositories/mbtiles_repository.dart` | 離線地圖包管理抽象介面 |
| `lib/features/mbtiles/presentation/pages/mbtiles_management_page.dart` | 離線地圖包匯入、選擇、刪除頁 |
| `lib/core/geo/haversine.dart` | 距離計算 |
| `lib/core/geo/twd97_converter.dart` | WGS84 轉 TWD97 |

## 下一步

安裝 Flutter SDK 後執行：

```powershell
flutter pub get
flutter analyze
flutter test
```

Android 後台定位、localhost tile server、MapLibre 實際渲染，還需要補平台設定並做實機測試。
