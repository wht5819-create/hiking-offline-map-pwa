param(
  [ValidateSet("north", "central", "south", "east", "islands", "all")]
  [string]$Region = "north",
  [int]$MinZoom = 10,
  [int]$MaxZoom = 14
)

$ErrorActionPreference = "Stop"

$regions = @{
  north = @{
    Bbox = "121.0,24.5,122.1,25.4"
    Output = ".\tiles\rudy-region-north-z$MinZoom-z$MaxZoom.mbtiles"
  }
  central = @{
    Bbox = "120.2,23.6,121.5,24.6"
    Output = ".\tiles\rudy-region-central-z$MinZoom-z$MaxZoom.mbtiles"
  }
  south = @{
    Bbox = "120.0,22.0,121.1,23.6"
    Output = ".\tiles\rudy-region-south-z$MinZoom-z$MaxZoom.mbtiles"
  }
  east = @{
    Bbox = "120.8,22.6,122.1,24.6"
    Output = ".\tiles\rudy-region-east-z$MinZoom-z$MaxZoom.mbtiles"
  }
  islands = @{
    Bbox = "118.0,21.8,120.1,26.4"
    Output = ".\tiles\rudy-region-islands-z$MinZoom-z$MaxZoom.mbtiles"
  }
  all = @{
    Bbox = "118.0,20.62439,123.0348,26.70665"
    Output = ".\tiles\rudy-taiwan-z$MinZoom-z$MaxZoom.mbtiles"
  }
}

$root = Split-Path -Parent $PSScriptRoot
$java = Join-Path $root "tools\runtime\temurin21-jre\jdk-21.0.11+10-jre\bin\java.exe"
$jar = Join-Path $root "tools\rudy-map-tiler\target\rudy-map-tiler-0.1.0.jar"
$inputMap = Join-Path $root "MOI_OSM_Taiwan_TOPO_Rudy.map\MOI_OSM_Taiwan_TOPO_Rudy.map"
$selected = $regions[$Region]

if (!(Test-Path -LiteralPath $java)) {
  throw "Java runtime not found: $java"
}

& $java "-Djava.awt.headless=true" -jar $jar `
  --input $inputMap `
  --output (Join-Path $root $selected.Output) `
  --bbox $selected.Bbox `
  --minZoom $MinZoom `
  --maxZoom $MaxZoom `
  --maxTiles 0 `
  --theme DEFAULT
