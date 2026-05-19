param(
  [string]$InputMap = ".\MOI_OSM_Taiwan_TOPO_Rudy.map\MOI_OSM_Taiwan_TOPO_Rudy.map",
  [string]$Output = ".\tiles\rudy-test.mbtiles",
  [string]$Bbox = "121.45,24.95,121.65,25.12",
  [int]$MinZoom = 12,
  [int]$MaxZoom = 14,
  [int]$MaxTiles = 20000,
  [string]$Theme = "DEFAULT"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolDir = Join-Path $projectRoot "tools\rudy-map-tiler"
$inputFull = (Resolve-Path -LiteralPath (Join-Path $projectRoot $InputMap)).Path
$outputFull = Join-Path $projectRoot $Output
$outputDir = Split-Path -Parent $outputFull
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$argsList = @(
  "-Djava.awt.headless=true",
  "-jar", "$toolDir\target\rudy-map-tiler-0.1.0.jar",
  "--input", $inputFull,
  "--output", $outputFull,
  "--bbox", $Bbox,
  "--minZoom", "$MinZoom",
  "--maxZoom", "$MaxZoom",
  "--maxTiles", "$MaxTiles",
  "--theme", $Theme
)

if (Get-Command java -ErrorAction SilentlyContinue) {
  Push-Location $toolDir
  try {
    if (!(Test-Path ".\target\rudy-map-tiler-0.1.0.jar")) {
      if (!(Get-Command mvn -ErrorAction SilentlyContinue)) {
        throw "Java is available, but Maven is not. Install Maven or use Docker."
      }
      mvn -q package
    }
  } finally {
    Pop-Location
  }
  java @argsList
  exit $LASTEXITCODE
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Java/Maven and Docker are both unavailable. Install Java 17 + Maven, or start Docker Desktop."
}

$dockerArgs = @(
  "run", "--rm",
  "-v", "${projectRoot}:/work",
  "-w", "/work/tools/rudy-map-tiler",
  "maven:3.9-eclipse-temurin-21",
  "mvn", "-q", "package", "exec:java",
  "-Dexec.args=--input /work/$($InputMap -replace '\\','/') --output /work/$($Output -replace '\\','/') --bbox $Bbox --minZoom $MinZoom --maxZoom $MaxZoom --maxTiles $MaxTiles --theme $Theme"
)

docker @dockerArgs
