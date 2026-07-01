Unicode true

Name "MYINC Social Media AI"
OutFile "..\dist-desktop\MYINC Social Media AI Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\MYINC Social Media AI"
RequestExecutionLevel user

SetCompressor /FINAL zlib
ShowInstDetails show
ShowUninstDetails show

!define APP_NAME "MYINC Social Media AI"
!define COMPANY_NAME "MYINC"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYINC Social Media AI"

Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section "Instalar"
  SetShellVarContext current

  IfFileExists "$INSTDIR\${APP_NAME}.exe" 0 +2
    RMDir /r "$INSTDIR"

  SetOutPath "$INSTDIR"
  File /r "..\dist-desktop\win-unpacked\*.*"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_NAME}.exe" "" "$INSTDIR\${APP_NAME}.exe" 0
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_NAME}.exe" "" "$INSTDIR\${APP_NAME}.exe" 0

  WriteUninstaller "$INSTDIR\Desinstalar MYINC Social Media AI.exe"

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${APP_NAME}.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Desinstalar MYINC Social Media AI.exe"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\Desinstalar MYINC Social Media AI.exe" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Desinstalar"
  SetShellVarContext current

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  RMDir /r "$INSTDIR"
SectionEnd
