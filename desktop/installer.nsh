; Always install for the current Windows user, without requesting elevation.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; Before 1.0 the app was Commander Archive, with appId dk.bircck.commanderarchive.
; Remove that installation as an upgrade would. Its uninstaller keeps
; %APPDATA%\Commander Archive, which DeckShelf copies on first start.
!define LEGACY_GUID "88eca9c9-f183-5c6f-a6a2-30ebb9d7ac7a"
!macro customInstall
  ReadRegStr $R8 HKCU "Software\${LEGACY_GUID}" InstallLocation
  ${if} $R8 != ""
  ${andIf} ${FileExists} "$R8\Uninstall Commander Archive.exe"
    DetailPrint "Removing Commander Archive"
    CopyFiles /SILENT "$R8\Uninstall Commander Archive.exe" "$PLUGINSDIR\legacy-uninstaller.exe"
    ExecWait '"$PLUGINSDIR\legacy-uninstaller.exe" /S /KEEP_APP_DATA /currentuser --updated _?=$R8' $R9
    DetailPrint "Commander Archive uninstaller exit code: $R9"
  ${endif}
!macroend
