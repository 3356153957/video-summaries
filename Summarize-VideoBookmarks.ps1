param(
    [ValidateSet("All", "Chrome", "Edge", "Brave")]
    [string]$Browser = "All",

    [string]$BookmarkFile,

    [string]$OutputPath,

    [string]$CacheDir = ".summaries",

    [int]$Limit = 0,

    [string[]]$Domains = @(
        "youtube.com",
        "youtu.be",
        "bilibili.com",
        "b23.tv",
        "vimeo.com",
        "dailymotion.com",
        "twitch.tv",
        "nicovideo.jp",
        "niconico.com",
        "douyin.com",
        "tiktok.com",
        "kuaishou.com",
        "ixigua.com",
        "youku.com",
        "iqiyi.com",
        "v.qq.com"
    ),

    [string]$Language = "zh-CN",

    [string]$Length = "long",

    [string]$Timeout = "10m",

    [string]$Model,

    [string]$CliProvider,

    [switch]$DryRun,

    [switch]$IncludeSiteHomepages,

    [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$Domains = @(
    $Domains |
        ForEach-Object { [string]$_ -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

function Join-BookmarkPath {
    param(
        [string]$Parent,
        [string]$Child
    )

    if ([string]::IsNullOrWhiteSpace($Child)) {
        return $Parent
    }

    if ([string]::IsNullOrWhiteSpace($Parent)) {
        return $Child
    }

    return "$Parent / $Child"
}

function Get-BookmarkFiles {
    param([string]$SelectedBrowser)

    if ($BookmarkFile) {
        if (-not (Test-Path -LiteralPath $BookmarkFile)) {
            throw "Bookmark file was not found: $BookmarkFile"
        }

        return @((Resolve-Path -LiteralPath $BookmarkFile).Path)
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    $browserRoots = @()

    if ($SelectedBrowser -eq "All" -or $SelectedBrowser -eq "Chrome") {
        $browserRoots += Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
    }
    if ($SelectedBrowser -eq "All" -or $SelectedBrowser -eq "Edge") {
        $browserRoots += Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
    }
    if ($SelectedBrowser -eq "All" -or $SelectedBrowser -eq "Brave") {
        $browserRoots += Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data"
    }

    foreach ($root in $browserRoots) {
        if (-not (Test-Path -LiteralPath $root)) {
            continue
        }

        Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" } |
            ForEach-Object {
                $path = Join-Path $_.FullName "Bookmarks"
                if (Test-Path -LiteralPath $path) {
                    $candidates.Add($path)
                }
            }
    }

    return @($candidates | Select-Object -Unique)
}

function Get-BookmarkNodeUrls {
    param(
        [object]$Node,
        [string]$Path
    )

    if ($null -eq $Node) {
        return
    }

    $type = ""
    if ($Node.PSObject.Properties.Name -contains "type") {
        $type = [string]$Node.type
    }

    if ($type -eq "url" -and ($Node.PSObject.Properties.Name -contains "url")) {
        [pscustomobject]@{
            Title = [string]$Node.name
            Url = [string]$Node.url
            Folder = $Path
        }
        return
    }

    if ($Node.PSObject.Properties.Name -contains "children") {
        $nextPath = Join-BookmarkPath -Parent $Path -Child ([string]$Node.name)
        foreach ($child in $Node.children) {
            Get-BookmarkNodeUrls -Node $child -Path $nextPath
        }
    }
}

function Get-BookmarkUrlsFromFile {
    param([string]$Path)

    $json = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $items = @()

    foreach ($property in $json.roots.PSObject.Properties) {
        $rootPath = $property.Name
        $items += Get-BookmarkNodeUrls -Node $property.Value -Path $rootPath
    }

    foreach ($item in $items) {
        [pscustomobject]@{
            Title = $item.Title
            Url = $item.Url
            Folder = $item.Folder
            Source = $Path
        }
    }
}

function Test-VideoBookmarkUrl {
    param(
        [string]$Url,
        [string[]]$AllowedDomains,
        [bool]$AllowHomepages
    )

    try {
        $uri = [Uri]$Url
    }
    catch {
        return $false
    }

    if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
        return $false
    }

    $uriHost = $uri.Host.ToLowerInvariant()
    $path = $uri.AbsolutePath.ToLowerInvariant()
    $query = $uri.Query.ToLowerInvariant()
    $isAllowedDomain = $false

    foreach ($domain in $AllowedDomains) {
        $normalized = $domain.ToLowerInvariant().Trim()
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }

        if ($uriHost -eq $normalized -or $uriHost.EndsWith(".$normalized")) {
            $isAllowedDomain = $true
            break
        }
    }

    if (-not $isAllowedDomain) {
        return $false
    }

    if ($AllowHomepages) {
        return $true
    }

    if ($uriHost -eq "youtu.be") {
        return $path -match "^/[^/]+"
    }
    if ($uriHost -eq "youtube.com" -or $uriHost.EndsWith(".youtube.com")) {
        return (
            ($path -eq "/watch" -and $query -match "(^|\?|&)v=") -or
            $path -match "^/(shorts|live|clip)/[^/]+"
        )
    }
    if ($uriHost -eq "b23.tv") {
        return $path -match "^/[^/]+"
    }
    if ($uriHost -eq "bilibili.com" -or $uriHost.EndsWith(".bilibili.com")) {
        return $path -match "^/(video|bangumi/play|medialist/play)/"
    }
    if ($uriHost -eq "vimeo.com" -or $uriHost.EndsWith(".vimeo.com")) {
        return $path -match "^/[^/]+"
    }
    if ($uriHost -eq "dailymotion.com" -or $uriHost.EndsWith(".dailymotion.com")) {
        return $path -match "^/video/"
    }
    if ($uriHost -eq "twitch.tv" -or $uriHost.EndsWith(".twitch.tv")) {
        return $path -match "^/videos/|/clip/"
    }
    if ($uriHost -eq "nicovideo.jp" -or $uriHost.EndsWith(".nicovideo.jp") -or $uriHost -eq "niconico.com" -or $uriHost.EndsWith(".niconico.com")) {
        return $path -match "^/watch/"
    }
    if ($uriHost -eq "douyin.com" -or $uriHost.EndsWith(".douyin.com")) {
        return $path -match "/video/"
    }
    if ($uriHost -eq "tiktok.com" -or $uriHost.EndsWith(".tiktok.com")) {
        return $path -match "/video/"
    }
    if ($uriHost -eq "kuaishou.com" -or $uriHost.EndsWith(".kuaishou.com")) {
        return $path -match "/short-video/"
    }
    if ($uriHost -eq "youku.com" -or $uriHost.EndsWith(".youku.com")) {
        return $path -match "/v_show/"
    }
    if ($uriHost -eq "iqiyi.com" -or $uriHost.EndsWith(".iqiyi.com")) {
        return $path -match "^/(v_|w_)"
    }
    if ($uriHost -eq "v.qq.com") {
        return $path -match "^/x/(page|cover)/"
    }

    return $path -match "^/[^/]+"
}

function Get-SafeFileName {
    param([string]$Value)

    $safe = $Value -replace "[\\/:*?`"<>|]", "_"
    $safe = $safe -replace "\s+", " "
    $safe = $safe.Trim()

    if ($safe.Length -gt 120) {
        $safe = $safe.Substring(0, 120).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($safe)) {
        $safe = "untitled"
    }

    return $safe
}

function Get-SummarizeCommand {
    $summarize = Get-Command summarize -ErrorAction SilentlyContinue
    if ($summarize) {
        return [pscustomobject]@{
            File = $summarize.Source
            PrefixArgs = @()
        }
    }

    $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npx) {
        $npx = Get-Command npx -ErrorAction SilentlyContinue
    }
    if (-not $npx) {
        throw "Could not find summarize or npx. Install Node.js and run: npm i -g @steipete/summarize"
    }

    return [pscustomobject]@{
        File = $npx.Source
        PrefixArgs = @("-y", "@steipete/summarize")
    }
}

function Invoke-SummarizeUrl {
    param(
        [object]$Command,
        [string]$Url
    )

    $args = @()
    $args += $Command.PrefixArgs
    $args += $Url
    $args += "--language"
    $args += $Language
    $args += "--length"
    $args += $Length
    $args += "--plain"
    $args += "--timeout"
    $args += $Timeout

    $hostName = ([Uri]$Url).Host.ToLowerInvariant()
    if ($hostName -eq "youtu.be" -or $hostName.EndsWith(".youtube.com") -or $hostName -eq "youtube.com") {
        $args += "--youtube"
        $args += "auto"
    }

    if (-not [string]::IsNullOrWhiteSpace($Model)) {
        $args += "--model"
        $args += $Model
    }

    if (-not [string]::IsNullOrWhiteSpace($CliProvider)) {
        $args += "--cli"
        $args += $CliProvider
    }

    $output = & $Command.File @args 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | Out-String).Trim()

    if ($exitCode -ne 0) {
        throw "summarize failed with exit code $exitCode.`n$text"
    }

    return $text
}

function Add-Utf8Text {
    param(
        [string]$Path,
        [string]$Text
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($Path, $Text, $encoding)
}

if (-not $OutputPath) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = Join-Path (Get-Location) "video-bookmark-summaries-$stamp.md"
}

$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$CacheDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CacheDir)

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

$bookmarkFiles = @(Get-BookmarkFiles -SelectedBrowser $Browser)
if ($bookmarkFiles.Count -eq 0) {
    throw "No browser bookmark files were found. Pass -BookmarkFile with a Chrome/Edge/Brave Bookmarks JSON path."
}

$bookmarks = @()
foreach ($file in $bookmarkFiles) {
    Write-Host "Reading bookmarks: $file"
    $bookmarks += Get-BookmarkUrlsFromFile -Path $file
}

$videoBookmarks = $bookmarks |
    Where-Object { Test-VideoBookmarkUrl -Url $_.Url -AllowedDomains $Domains -AllowHomepages $IncludeSiteHomepages.IsPresent } |
    Sort-Object Url -Unique

if ($Limit -gt 0) {
    $videoBookmarks = @($videoBookmarks | Select-Object -First $Limit)
}
else {
    $videoBookmarks = @($videoBookmarks)
}

if ($videoBookmarks.Count -eq 0) {
    Write-Host "No matching video bookmarks were found."
    return
}

if ($DryRun) {
    $videoBookmarks | Select-Object Title, Url, Folder, Source | Format-Table -AutoSize
    Write-Host "Dry run only. Matched $($videoBookmarks.Count) video bookmarks."
    return
}

$command = Get-SummarizeCommand
$runStarted = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$header = @"
# Video Bookmark Summaries

- Generated: $runStarted
- Browser: $Browser
- Matched bookmarks: $($videoBookmarks.Count)
- Language: $Language
- Length: $Length

"@

[System.IO.File]::WriteAllText($OutputPath, $header, (New-Object System.Text.UTF8Encoding($false)))

$index = 0
foreach ($bookmark in $videoBookmarks) {
    $index++
    $title = if ([string]::IsNullOrWhiteSpace($bookmark.Title)) { $bookmark.Url } else { $bookmark.Title }
    $safeName = Get-SafeFileName -Value ("{0:D3}-{1}" -f $index, $title)
    $cachePath = Join-Path $CacheDir "$safeName.md"

    Write-Host "[$index/$($videoBookmarks.Count)] $title"

    if ((Test-Path -LiteralPath $cachePath) -and -not $Force) {
        $summary = Get-Content -LiteralPath $cachePath -Raw -Encoding UTF8
    }
    else {
        try {
            $summary = Invoke-SummarizeUrl -Command $command -Url $bookmark.Url
            [System.IO.File]::WriteAllText($cachePath, $summary, (New-Object System.Text.UTF8Encoding($false)))
        }
        catch {
            $summary = "ERROR: $($_.Exception.Message)"
            [System.IO.File]::WriteAllText($cachePath, $summary, (New-Object System.Text.UTF8Encoding($false)))
        }
    }

    $section = @"
## $title

- URL: $($bookmark.Url)
- Folder: $($bookmark.Folder)
- Source: $($bookmark.Source)

$summary

---

"@
    Add-Utf8Text -Path $OutputPath -Text $section
}

Write-Host "Done: $OutputPath"
