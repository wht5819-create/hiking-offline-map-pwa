param(
  [string]$InputMap = ".\MOI_OSM_Taiwan_TOPO_Rudy.map\MOI_OSM_Taiwan_TOPO_Rudy.map",
  [string]$Output = ".\tiles\rudy-test.mbtiles",
  [string]$Bbox = "121.45,24.95,121.65,25.12",
  [string]$Gpx = "",
  [double]$GpxBuffer = 0.03,
  [int]$MinZoom = 12,
  [int]$MaxZoom = 14,
  [int]$MaxTiles = 20000,
  [string]$Theme = "DEFAULT"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolDir = Join-Path $projectRoot "tools\rudy-map-tiler"

function Resolve-ProjectPath([string]$PathValue, [switch]$MustExist) {
  $candidate = if ([System.IO.Path]::IsPathRooted($PathValue)) {
    $PathValue
  } else {
    Join-Path $projectRoot $PathValue
  }
  if ($MustExist) {
    return (Resolve-Path -LiteralPath $candidate).Path
  }
  return [System.IO.Path]::GetFullPath($candidate)
}

function Convert-ToContainerPath([string]$FullPath) {
  $root = (Resolve-Path -LiteralPath $projectRoot).Path.TrimEnd("\") + "\"
  $rootUri = [Uri]$root
  $fileUri = [Uri]$FullPath
  if (!$rootUri.IsBaseOf($fileUri)) {
    throw "Docker mode requires input/output paths under project root: $FullPath"
  }
  return "/work/" + ([Uri]::UnescapeDataString($rootUri.MakeRelativeUri($fileUri).ToString()))
}

$inputFull = Resolve-ProjectPath $InputMap -MustExist
$outputFull = Resolve-ProjectPath $Output
$outputDir = Split-Path -Parent $outputFull
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if ($Gpx) {
  $gpxFull = Resolve-ProjectPath $Gpx -MustExist
  [xml]$gpxXml = Get-Content -LiteralPath $gpxFull -Raw
  $points = @($gpxXml.GetElementsByTagName("trkpt")) + @($gpxXml.GetElementsByTagName("rtept")) + @($gpxXml.GetElementsByTagName("wpt"))
  if ($points.Count -eq 0) {
    throw "No GPX points found in $gpxFull"
  }
  $lats = @()
  $lons = @()
  foreach ($point in $points) {
    $lats += [double]$point.lat
    $lons += [double]$point.lon
  }
  $minLat = (($lats | Measure-Object -Minimum).Minimum) - $GpxBuffer
  $maxLat = (($lats | Measure-Object -Maximum).Maximum) + $GpxBuffer
  $minLon = (($lons | Measure-Object -Minimum).Minimum) - $GpxBuffer
  $maxLon = (($lons | Measure-Object -Maximum).Maximum) + $GpxBuffer
  $Bbox = "$minLon,$minLat,$maxLon,$maxLat"
  Write-Host "Using GPX bbox: $Bbox"
}

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
  "-Dexec.args=--input $(Convert-ToContainerPath $inputFull) --output $(Convert-ToContainerPath $outputFull) --bbox $Bbox --minZoom $MinZoom --maxZoom $MaxZoom --maxTiles $MaxTiles --theme $Theme"
)

docker @dockerArgs
