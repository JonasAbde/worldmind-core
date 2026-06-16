# Install generated character PNGs and encode webp sidecars (ffmpeg).
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$Gen = Join-Path $Repo '.cursor\projects\c-Users-empir-workspace-Project-Worldmind\assets'
if (-not (Test-Path $Gen)) {
  $Gen = Join-Path $env:USERPROFILE '.cursor\projects\c-Users-empir-workspace-Project-Worldmind\assets'
}

$map = @(
  @{ id = 'omar'; portrait = 'omar-portrait-gen.png'; fullbody = 'omar-fullbody-gen.png' },
  @{ id = 'lina'; portrait = 'lina-portrait-gen.png'; fullbody = 'lina-fullbody-gen.png' },
  @{ id = 'yasin'; portrait = 'yasin-portrait-gen.png'; fullbody = 'yasin-fullbody-gen.png' },
  @{ id = 'freja'; portrait = 'freja-portrait-gen.png'; fullbody = 'freja-fullbody-gen.png' },
  @{ id = 'elias'; portrait = 'elias-portrait-gen.png'; fullbody = 'elias-fullbody-gen.png' },
  @{ id = 'nadia'; portrait = $null; fullbody = 'nadia-fullbody-gen.png' }
)

function Encode-Webp($pngPath) {
  $webpPath = [System.IO.Path]::ChangeExtension($pngPath, '.webp')
  & ffmpeg -y -loglevel error -i $pngPath -c:v libwebp -quality 86 $webpPath
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $pngPath" }
}

foreach ($entry in $map) {
  $dir = Join-Path $Repo "assets\characters\$($entry.id)"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  if ($entry.portrait) {
    $src = Join-Path $Gen $entry.portrait
    if (-not (Test-Path $src)) { throw "Missing generated file: $src" }
    $dst = Join-Path $dir 'portrait.png'
    Copy-Item -Force $src $dst
    Copy-Item -Force $dst (Join-Path $dir 'avatar.png')
    Encode-Webp $dst
    Encode-Webp (Join-Path $dir 'avatar.png')
    Write-Host "Installed portrait + avatar: $($entry.id)"
  }

  if ($entry.fullbody) {
    $src = Join-Path $Gen $entry.fullbody
    if (-not (Test-Path $src)) { throw "Missing generated file: $src" }
    $dst = Join-Path $dir 'fullbody.png'
    Copy-Item -Force $src $dst
    Encode-Webp $dst
    Write-Host "Installed fullbody: $($entry.id)"
  }

  $note = Join-Path $dir 'ASSET_REVIEW_NOTE.md'
  @"
# $($entry.id) reviewed art

Reviewed single-generated replacement. Not a sheet crop.
Generated for WorldMind 3D embodied characters ($(Get-Date -Format 'yyyy-MM-dd')).
"@ | Set-Content -Encoding utf8 $note
}

Write-Host 'Done.'
