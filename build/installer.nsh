!macro customInit
  ; Force-kill any running instances (ignore errors if not running)
  nsExec::ExecToStack 'cmd /c taskkill /F /IM "Nedai Study Assistant.exe" 2>nul'
  Pop $0
  Pop $1

  ; Delete stale Electron single-instance lock files
  Delete "$APPDATA\Nedai Study Assistant\SingleInstanceLock"
  Delete "$LOCALAPPDATA\Nedai Study Assistant\SingleInstanceLock"

  ; Give the OS time to release file handles
  Sleep 1500
!macroend

!macro customUnInit
  ; Same cleanup during uninstall to prevent stale locks blocking future installs
  nsExec::ExecToStack 'cmd /c taskkill /F /IM "Nedai Study Assistant.exe" 2>nul'
  Pop $0
  Pop $1

  Delete "$APPDATA\Nedai Study Assistant\SingleInstanceLock"
  Delete "$LOCALAPPDATA\Nedai Study Assistant\SingleInstanceLock"

  Sleep 1000
!macroend
