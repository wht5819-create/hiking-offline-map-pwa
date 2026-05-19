param(
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
  throw "找不到 flutter 指令。請先安裝 Flutter SDK，並把 flutter/bin 加入 PATH。"
}

flutter create .
flutter pub get
flutter analyze

if (-not $SkipTests) {
  flutter test
}

Write-Host "Flutter 專案已建立並完成基本檢查。"
