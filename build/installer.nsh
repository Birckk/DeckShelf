; Always install for the current Windows user, without requesting elevation.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
