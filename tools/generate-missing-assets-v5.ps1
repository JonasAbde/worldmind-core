Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

function New-DirIfMissing {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-Bitmap {
  param([int]$Width, [int]$Height)
  return New-Object System.Drawing.Bitmap($Width, $Height)
}

function Draw-CroppedScaled {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$SourceImage,
    [System.Drawing.Rectangle]$SourceRect,
    [System.Drawing.Rectangle]$DestRect
  )
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.DrawImage($SourceImage, $DestRect, $SourceRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Add-GradeOverlay {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [System.Drawing.Color]$TopColor,
    [System.Drawing.Color]$BottomColor
  )
  $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    $TopColor,
    $BottomColor,
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $Graphics.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Add-Label {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [string]$Label,
    [System.Drawing.Color]$Accent
  )
  $barBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 10, 15, 22))
  $Graphics.FillRectangle($barBrush, 0, $Height - 72, $Width, 72)
  $barBrush.Dispose()

  $pen = New-Object System.Drawing.Pen($Accent, 4)
  $Graphics.DrawLine($pen, 24, $Height - 20, $Width - 24, $Height - 20)
  $pen.Dispose()

  $font = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 230, 245, 255))
  $Graphics.DrawString($Label, $font, $textBrush, 24, $Height - 62)
  $textBrush.Dispose()
  $font.Dispose()
}

function Build-CharacterPack {
  param(
    [System.Drawing.Image]$SourceSheet,
    [string]$CharacterId,
    [System.Drawing.Rectangle]$SourceRect,
    [System.Drawing.Color]$TopOverlay,
    [System.Drawing.Color]$BottomOverlay,
    [System.Drawing.Color]$Accent
  )
  $baseDir = "assets/characters/$CharacterId"
  New-DirIfMissing -Path $baseDir

  # Portrait 768x512
  $portrait = New-Bitmap -Width 768 -Height 512
  $gPortrait = [System.Drawing.Graphics]::FromImage($portrait)
  Draw-CroppedScaled -Graphics $gPortrait -SourceImage $SourceSheet -SourceRect $SourceRect -DestRect (New-Object System.Drawing.Rectangle(0,0,768,512))
  Add-GradeOverlay -Graphics $gPortrait -Width 768 -Height 512 -TopColor $TopOverlay -BottomColor $BottomOverlay
  Add-Label -Graphics $gPortrait -Width 768 -Height 512 -Label ($CharacterId.ToUpper()) -Accent $Accent
  Save-Png -Bitmap $portrait -Path "$baseDir/portrait.png"

  # Avatar 256x256
  $avatar = New-Bitmap -Width 256 -Height 256
  $gAvatar = [System.Drawing.Graphics]::FromImage($avatar)
  Draw-CroppedScaled -Graphics $gAvatar -SourceImage $portrait -SourceRect (New-Object System.Drawing.Rectangle(120, 40, 512, 512)) -DestRect (New-Object System.Drawing.Rectangle(0,0,256,256))
  Add-GradeOverlay -Graphics $gAvatar -Width 256 -Height 256 -TopColor ([System.Drawing.Color]::FromArgb(28, 0, 0, 0)) -BottomColor ([System.Drawing.Color]::FromArgb(64, 0, 0, 0))
  Save-Png -Bitmap $avatar -Path "$baseDir/avatar.png"

  # Expressions 512x256 variations from portrait
  $expressions = @(
    @{ Name = "expression-neutral.png"; Top = [System.Drawing.Color]::FromArgb(20, 20, 40, 56); Bottom = [System.Drawing.Color]::FromArgb(55, 0, 0, 0) },
    @{ Name = "expression-focused.png"; Top = [System.Drawing.Color]::FromArgb(24, 16, 62, 84); Bottom = [System.Drawing.Color]::FromArgb(62, 0, 0, 0) },
    @{ Name = "expression-worried.png"; Top = [System.Drawing.Color]::FromArgb(24, 80, 42, 28); Bottom = [System.Drawing.Color]::FromArgb(72, 0, 0, 0) },
    @{ Name = "expression-concerned.png"; Top = [System.Drawing.Color]::FromArgb(24, 70, 36, 24); Bottom = [System.Drawing.Color]::FromArgb(76, 0, 0, 0) }
  )

  foreach ($exp in $expressions) {
    $expr = New-Bitmap -Width 512 -Height 256
    $gExpr = [System.Drawing.Graphics]::FromImage($expr)
    Draw-CroppedScaled -Graphics $gExpr -SourceImage $portrait -SourceRect (New-Object System.Drawing.Rectangle(128, 36, 512, 256)) -DestRect (New-Object System.Drawing.Rectangle(0,0,512,256))
    Add-GradeOverlay -Graphics $gExpr -Width 512 -Height 256 -TopColor $exp.Top -BottomColor $exp.Bottom
    Save-Png -Bitmap $expr -Path "$baseDir/$($exp.Name)"
    $gExpr.Dispose()
    $expr.Dispose()
  }

  # Character sheet 1448x1086
  $sheet = New-Bitmap -Width 1448 -Height 1086
  $gSheet = [System.Drawing.Graphics]::FromImage($sheet)
  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 16, 24))
  $gSheet.FillRectangle($bgBrush, 0, 0, 1448, 1086)
  $bgBrush.Dispose()

  Draw-CroppedScaled -Graphics $gSheet -SourceImage $portrait -SourceRect (New-Object System.Drawing.Rectangle(0,0,768,512)) -DestRect (New-Object System.Drawing.Rectangle(80,120,928,620))
  Add-GradeOverlay -Graphics $gSheet -Width 1448 -Height 1086 -TopColor ([System.Drawing.Color]::FromArgb(22, 10, 42, 58)) -BottomColor ([System.Drawing.Color]::FromArgb(48, 0, 0, 0))
  Add-Label -Graphics $gSheet -Width 1448 -Height 1086 -Label "WORLDMIND AGENT $($CharacterId.ToUpper())" -Accent $Accent

  Draw-CroppedScaled -Graphics $gSheet -SourceImage $avatar -SourceRect (New-Object System.Drawing.Rectangle(0,0,256,256)) -DestRect (New-Object System.Drawing.Rectangle(1080,150,280,280))
  Save-Png -Bitmap $sheet -Path "$baseDir/character-sheet.png"

  $gSheet.Dispose()
  $sheet.Dispose()
  $gAvatar.Dispose()
  $avatar.Dispose()
  $gPortrait.Dispose()
  $portrait.Dispose()
}

function Build-LocationScene {
  param(
    [System.Drawing.Image]$SourceImage,
    [string]$OutputPath,
    [string]$Label,
    [System.Drawing.Color]$TopOverlay,
    [System.Drawing.Color]$BottomOverlay,
    [System.Drawing.Color]$Accent
  )
  $scene = New-Bitmap -Width 1672 -Height 941
  $g = [System.Drawing.Graphics]::FromImage($scene)
  Draw-CroppedScaled -Graphics $g -SourceImage $SourceImage -SourceRect (New-Object System.Drawing.Rectangle(0, 0, $SourceImage.Width, $SourceImage.Height)) -DestRect (New-Object System.Drawing.Rectangle(0, 0, 1672, 941))
  Add-GradeOverlay -Graphics $g -Width 1672 -Height 941 -TopColor $TopOverlay -BottomColor $BottomOverlay
  Add-Label -Graphics $g -Width 1672 -Height 941 -Label $Label -Accent $Accent
  Save-Png -Bitmap $scene -Path $OutputPath
  $g.Dispose()
  $scene.Dispose()
}

$npcSheet = [System.Drawing.Image]::FromFile("assets/characters/npc-portrait-set.png")

$characterSpecs = @(
  @{ id = "omar";  src = (New-Object System.Drawing.Rectangle(40, 120, 560, 760));  top = [System.Drawing.Color]::FromArgb(22, 14, 70, 92); bottom = [System.Drawing.Color]::FromArgb(68, 6, 8, 16); accent = [System.Drawing.Color]::FromArgb(255, 94, 210, 244) },
  @{ id = "lina";  src = (New-Object System.Drawing.Rectangle(280, 110, 560, 760)); top = [System.Drawing.Color]::FromArgb(24, 18, 64, 86); bottom = [System.Drawing.Color]::FromArgb(70, 8, 10, 18); accent = [System.Drawing.Color]::FromArgb(255, 122, 225, 255) },
  @{ id = "yasin"; src = (New-Object System.Drawing.Rectangle(520, 118, 560, 760)); top = [System.Drawing.Color]::FromArgb(28, 10, 74, 110); bottom = [System.Drawing.Color]::FromArgb(72, 8, 12, 20); accent = [System.Drawing.Color]::FromArgb(255, 80, 188, 245) },
  @{ id = "freja"; src = (New-Object System.Drawing.Rectangle(760, 108, 560, 760)); top = [System.Drawing.Color]::FromArgb(24, 18, 82, 72); bottom = [System.Drawing.Color]::FromArgb(66, 8, 14, 14); accent = [System.Drawing.Color]::FromArgb(255, 120, 230, 198) },
  @{ id = "elias"; src = (New-Object System.Drawing.Rectangle(900, 126, 520, 740)); top = [System.Drawing.Color]::FromArgb(24, 22, 64, 70); bottom = [System.Drawing.Color]::FromArgb(70, 12, 8, 14); accent = [System.Drawing.Color]::FromArgb(255, 236, 177, 104) }
)

foreach ($spec in $characterSpecs) {
  Build-CharacterPack -SourceSheet $npcSheet -CharacterId $spec.id -SourceRect $spec.src -TopOverlay $spec.top -BottomOverlay $spec.bottom -Accent $spec.accent
}

$npcSheet.Dispose()

$apartmentSource = [System.Drawing.Image]::FromFile("assets/locations/apartment.png")
Build-LocationScene -SourceImage $apartmentSource -OutputPath "assets/locations/apartment-v5-reviewed.png" -Label "NEW AARHUS SAFE HUB / APARTMENT V5" -TopOverlay ([System.Drawing.Color]::FromArgb(18, 26, 48, 58)) -BottomOverlay ([System.Drawing.Color]::FromArgb(52, 6, 8, 14)) -Accent ([System.Drawing.Color]::FromArgb(255, 114, 220, 230))
$apartmentSource.Dispose()

$harbourSource = [System.Drawing.Image]::FromFile("assets/concept/new-aarhus-district-01.png")
Build-LocationScene -SourceImage $harbourSource -OutputPath "assets/locations/harbour-docks-v5-reviewed.png" -Label "NEW AARHUS HARBOUR DOCKS V5" -TopOverlay ([System.Drawing.Color]::FromArgb(22, 8, 42, 62)) -BottomOverlay ([System.Drawing.Color]::FromArgb(66, 8, 10, 20)) -Accent ([System.Drawing.Color]::FromArgb(255, 92, 180, 255))
$harbourSource.Dispose()

Write-Output "generated_v5_assets_ok"
