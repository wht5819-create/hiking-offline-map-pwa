# 平台設定

## 建立平台目錄

在有 Flutter SDK 的電腦，於專案根目錄執行：

```powershell
powershell -ExecutionPolicy Bypass -File tools/bootstrap_flutter_project.ps1
```

這會執行：

```powershell
flutter create .
flutter pub get
flutter analyze
flutter test
```

## Android 權限

產生 `android/` 後，在 `android/app/src/main/AndroidManifest.xml` 加入：

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

若實機上 MapLibre 無法讀取 `http://127.0.0.1:<port>`，需要在 Android network security config 允許 localhost cleartext。通常只允許 localhost，不要開全域明文流量。

## iOS 權限

產生 `ios/` 後，在 `ios/Runner/Info.plist` 加入定位用途描述：

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>用於登山時顯示目前位置與偏離航線提醒。</string>
```

若需要背景定位，還要開啟 Background Modes 的 Location updates，並補上 `NSLocationAlwaysAndWhenInUseUsageDescription`。

## 實機驗收重點

1. App 可匯入 `.mbtiles`。
2. 地圖頁可啟動 localhost tile server 並顯示地圖。
3. GPX 匯入後能疊線。
4. GPS 權限請求正常。
5. 偏離航線超過 50 公尺時會提示。
