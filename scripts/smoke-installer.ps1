param(
    # Optional Commander Archive installer (the app's name before 1.0) to test upgrading a real prior installation.
    [string]$LegacySetup
)
$ErrorActionPreference = 'Stop'
# Installing/uninstalling registers shortcuts and HKCU entries. Run this only on
# the disposable GitHub Windows runner, never against the owner's installation.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Installer lifecycle testing requires a disposable GitHub Windows runner.'
}
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') | ConvertFrom-Json).version
$setup = Join-Path $repoRoot "release\DeckShelf-Setup-$version-x64.exe"
$installDir = Join-Path $repoRoot 'qa\installed-application'
$legacyDir = Join-Path $repoRoot 'qa\legacy-application'
$profile = Join-Path $env:APPDATA 'DeckShelf'
$legacyProfile = Join-Path $env:APPDATA 'Commander Archive'
$shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\DeckShelf.lnk'
$legacyShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Commander Archive.lnk'
$registryRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
function Get-AppRegistration([string]$name) {
    # A fresh Windows user may have no per-user uninstall registry key yet.
    if (Test-Path -LiteralPath $registryRoot) {
        Get-ChildItem $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq $name }
    }
}
function Install-Setup([string]$path, [string]$directory, [string]$executable) {
    # NSIS /D is last and unquoted, including any spaces in the directory name.
    $process = Start-Process -FilePath $path -ArgumentList "/S /D=$directory" -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode)" }
    if (-not (Test-Path -LiteralPath (Join-Path $directory $executable))) { throw "Missing installed $executable" }
}
$existing = @(Get-AppRegistration 'DeckShelf') + @(Get-AppRegistration 'Commander Archive')
if ($existing.Count -or (Test-Path -LiteralPath $profile) -or (Test-Path -LiteralPath $legacyProfile) -or (Test-Path -LiteralPath $installDir) -or (Test-Path -LiteralPath $legacyDir)) {
    throw 'A prior installation/profile exists. Refusing to alter it.'
}
if ($LegacySetup) {
    Install-Setup $LegacySetup $legacyDir 'Commander Archive.exe'
    if (@(Get-AppRegistration 'Commander Archive').Count -ne 1) { throw 'Expected one Commander Archive uninstall entry' }
    if (-not (Test-Path -LiteralPath $legacyShortcut)) { throw 'Missing Commander Archive Start menu shortcut' }
    & node (Join-Path $repoRoot 'scripts/smoke-upgrade.mjs') seed (Join-Path $legacyDir 'Commander Archive.exe') $legacyProfile
    if ($LASTEXITCODE -ne 0) { throw 'Could not save a collection in Commander Archive' }
}
try {
    Install-Setup $setup $installDir 'DeckShelf.exe'
    $entry = @(Get-AppRegistration 'DeckShelf')
    if ($entry.Count -ne 1) { throw 'Expected one per-user uninstall entry' }
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Missing Start menu shortcut' }
    if ($LegacySetup) {
        # Installing DeckShelf replaces Commander Archive but keeps its profile.
        if (@(Get-AppRegistration 'Commander Archive').Count) { throw 'Commander Archive is still registered' }
        if (Test-Path -LiteralPath (Join-Path $legacyDir 'Commander Archive.exe')) { throw 'Commander Archive executable remains' }
        if (Test-Path -LiteralPath $legacyShortcut) { throw 'Commander Archive Start menu shortcut remains' }
        if (-not (Test-Path -LiteralPath (Join-Path $legacyProfile 'Local Storage'))) { throw 'Upgrade removed the Commander Archive profile' }
        & node (Join-Path $repoRoot 'scripts/smoke-upgrade.mjs') verify (Join-Path $installDir 'DeckShelf.exe') $env:APPDATA
        if ($LASTEXITCODE -ne 0) { throw 'DeckShelf did not keep the Commander Archive collection' }
        if (-not (Test-Path -LiteralPath (Join-Path $legacyProfile 'Local Storage'))) { throw 'Migration removed the Commander Archive profile' }
    } else {
        New-Item -ItemType Directory -Path $profile | Out-Null
    }
    $sentinel = Join-Path $profile 'installer-preservation-check.txt'
    Set-Content -LiteralPath $sentinel -Value 'Keep the user profile'
    Install-Setup $setup $installDir 'DeckShelf.exe' # Same-version reinstall/repair.
    if (-not (Test-Path -LiteralPath $sentinel)) { throw 'Reinstall removed user data' }
    & node (Join-Path $repoRoot 'scripts/smoke-desktop.mjs') --app-dir $installDir
    if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
} finally {
    $uninstaller = Join-Path $installDir 'Uninstall DeckShelf.exe'
    if (Test-Path -LiteralPath $uninstaller) {
        $process = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installDir" -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw "Uninstaller exit code: $($process.ExitCode)" }
    }
}
if (-not (Test-Path -LiteralPath $sentinel)) { throw 'Uninstall removed the user profile' }
if (Test-Path -LiteralPath (Join-Path $installDir 'DeckShelf.exe')) { throw 'Uninstall left the application executable' }
if (Test-Path -LiteralPath $shortcut) { throw 'Uninstall left the Start menu shortcut' }
$remaining = @(Get-AppRegistration 'DeckShelf')
if ($remaining.Count) { throw 'Uninstall left its registry entry' }
$upgrade = if ($LegacySetup) { ' Commander Archive upgrade with collection kept,' } else { '' }
Write-Output "PASS:$upgrade per-user install, shortcut, reinstall, installed application, uninstall, profile preservation."
