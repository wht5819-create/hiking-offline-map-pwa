# 登山離線地圖 App 專案結構

```text
lib/
├── main.dart
├── app/
│   ├── hiking_app.dart
│   └── router/
├── core/
│   ├── errors/
│   ├── geo/
│   │   ├── haversine.dart
│   │   └── twd97_converter.dart
│   └── utils/
├── features/
│   ├── offline_map/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   ├── models/
│   │   │   └── repositories/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── repositories/
│   │   │   └── usecases/
│   │   └── presentation/
│   │       ├── controllers/
│   │       └── widgets/
│   ├── gpx/
│   │   ├── data/
│   │   │   ├── models/
│   │   │   └── services/
│   │   ├── domain/
│   │   │   └── entities/
│   │   └── presentation/
│   ├── tracking/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   └── mbtiles/
│       ├── data/
│       │   ├── datasources/
│       │   └── repositories/
│       ├── domain/
│       └── presentation/
└── shared/
    ├── widgets/
    └── theme/

assets/
└── map_styles/
    └── rudy_map_offline_style.template.json
```

## 主要資料夾職責

| 資料夾 | 職責 | 為什麼重要 |
|---|---|---|
| `core/geo` | 共用地理計算，例如 Haversine、TWD97 座標轉換 | 登山 App 的安全與定位判斷不能分散在 UI 裡 |
| `features/offline_map` | MapLibre 離線地圖渲染、Style JSON、圖層開關 | 地圖是最吃效能的核心模組，需與 GPX/GPS 解耦 |
| `features/gpx` | GPX 匯入、解析、轉成地圖可繪製資料 | 支援使用者載入前人航跡，是防迷路體驗的基礎 |
| `features/tracking` | GPS 定位串流、偏離航線警報、軌跡記錄 | 直接影響登山安全，需要獨立測試與維護 |
| `features/mbtiles` | `.mbtiles` 檔案匯入、儲存、驗證、刪除 | 台灣山區離線使用時，地圖包管理是關鍵流程 |
| `shared/` | 跨功能共用 UI 與主題 | 避免各模組重複寫相同元件 |
