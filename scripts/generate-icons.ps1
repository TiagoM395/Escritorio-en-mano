# Genera los iconos de la app (líquido oscuro + rayo cian) y los guarda en src-tauri/icons.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-AppIcon([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $d = [int]($size * 0.24)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 15, 23, 42), [System.Drawing.Color]::FromArgb(255, 8, 10, 28), 45)
    $g.FillPath($bg, $path)

    $c = [int]($size * 0.5)
    $innerR = [int]($size * 0.30)
    $innerRect = New-Object System.Drawing.Rectangle(($c - $innerR), ($c - $innerR), ($innerR * 2), ($innerR * 2))
    $glow = New-Object System.Drawing.Drawing2D.LinearGradientBrush($innerRect, [System.Drawing.Color]::FromArgb(255, 34, 211, 238), [System.Drawing.Color]::FromArgb(255, 129, 140, 248), 90)
    $g.FillEllipse($glow, $innerRect)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($size * 0.052))
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $pen.LineJoin = 'Round'
    $w = [float]$size
    $pts = @(
        (New-Object System.Drawing.PointF(($w * 0.52), ($w * 0.16))),
        (New-Object System.Drawing.PointF(($w * 0.28), ($w * 0.56))),
        (New-Object System.Drawing.PointF(($w * 0.47), ($w * 0.56))),
        (New-Object System.Drawing.PointF(($w * 0.42), ($w * 0.84))),
        (New-Object System.Drawing.PointF(($w * 0.70), ($w * 0.42))),
        (New-Object System.Drawing.PointF(($w * 0.51), ($w * 0.42)))
    )
    $g.DrawLines($pen, $pts)

    $g.Dispose()
    return $bmp
}

$dir = Join-Path $PSScriptRoot '..\src-tauri\icons'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$icon512 = New-AppIcon 512
$icon512.Save((Join-Path $dir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()

$icon32 = New-AppIcon 32
$icon32.Save((Join-Path $dir '32x32.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon32.Dispose()

$icon128 = New-AppIcon 128
$icon128.Save((Join-Path $dir '128x128.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon128.Dispose()

$icon256 = New-AppIcon 256
$icon256.Save((Join-Path $dir '128x128@2x.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$icoHandle = $icon256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($icoHandle)
$fs = [System.IO.File]::Create((Join-Path $dir 'icon.ico'))
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$icon256.Dispose()

Write-Host 'Iconos generados en' $dir
