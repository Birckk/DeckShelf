$ErrorActionPreference = 'Stop'
# Installing/uninstalling registers shortcuts and HKCU entries. Run this only on
# the disposable GitHub Windows runner, never against the owner's installation.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Installer lifecycle testing requires a disposable GitHub Windows runner.'
}
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') | ConvertFrom-Json).version
$setup = Join-Path $repoRoot "release\Commander-Archive-Setup-$version-x64.exe"
$installDir = Join-Path $repoRoot 'qa\installed-application'
$profile = Join-Path $env:APPDATA 'Commander Archive'
$registryRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$existing = @(Get-ChildItem $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'Commander Archive' })
if ($existing.Count -or (Test-Path -LiteralPath $profile) -or (Test-Path -LiteralPath $installDir)) {
    throw 'A prior installation/profile exists. Refusing to alter it.'
}
New-Item -ItemType Directory -Path $profile | Out-Null
$sentinel = Join-Path $profile 'installer-preservation-check.txt'
Set-Content -LiteralPath $sentinel -Value 'Keep the user profile'
function Install-Candidate {
    # NSIS /D is last and unquoted, including any spaces in the directory name.
    $process = Start-Process -FilePath $setup -ArgumentList "/S /D=$installDir" -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode)" }
    if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Commander Archive.exe'))) { throw 'Missing installed application' }
}
try {
    Install-Candidate
    $entry = @(Get-ChildItem $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'Commander Archive' })
    if ($entry.Count -ne 1) { throw 'Expected one per-user uninstall entry' }
    $shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Commander Archive.lnk'
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Missing Start menu shortcut' }
    Install-Candidate # Same-version reinstall/repair; future-version migrations are separate.
    if (-not (Test-Path -LiteralPath $sentinel)) { throw 'Reinstall removed user data' }
    & node (Join-Path $repoRoot 'scripts/smoke-desktop.mjs') --app-dir $installDir
    if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
} finally {
    $uninstaller = Join-Path $installDir 'Uninstall Commander Archive.exe'
    if (Test-Path -LiteralPath $uninstaller) {
        $process = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installDir" -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw "Uninstaller exit code: $($process.ExitCode)" }
    }
}
if (-not (Test-Path -LiteralPath $sentinel)) { throw 'Uninstall removed the user profile' }
if (Test-Path -LiteralPath (Join-Path $installDir 'Commander Archive.exe')) { throw 'Uninstall left the application executable' }
if (Test-Path -LiteralPath $shortcut) { throw 'Uninstall left the Start menu shortcut' }
$remaining = @(Get-ChildItem $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'Commander Archive' })
if ($remaining.Count) { throw 'Uninstall left its registry entry' }
Write-Output 'PASS: per-user install, shortcut, reinstall, installed application, uninstall, profile preservation.'
