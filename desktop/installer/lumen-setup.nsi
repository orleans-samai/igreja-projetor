!ifndef UNPACKED
  !error "Passe -DUNPACKED=caminho do win-unpacked"
!endif
!ifndef OUTFILE
  !error "Passe -DOUTFILE=Lúmen-Setup.exe"
!endif

Unicode True
SetCompressor /SOLID lzma
SetCompressorDictSize 64

Name "Lúmen"
Caption "Instalar Lúmen"
BrandingText "Lúmen — projeção para o culto"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Lúmen"
InstallDirRegKey HKCU "Software\Lúmen" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
CRCCheck on

!define PRODUCT_NAME "Lúmen"
!define PRODUCT_VERSION "1.0.0"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!ifdef ICON
  !define MUI_ICON "${ICON}"
  !define MUI_UNICON "${ICON}"
!endif
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Lúmen"
!define MUI_WELCOMEPAGE_TEXT "Este instalador coloca o Lúmen no computador da cabine.$\r$\n$\r$\nNão precisa de senha de administrador. Depois abra pelo Menu Iniciar e use Windows + P, opção Estender, para o projetor."
!define MUI_DIRECTORYPAGE_TEXT_TOP "O Lúmen será instalado na pasta abaixo (só para este usuário)."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Lúmen.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o Lúmen agora"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TEXT "Pronto. No culto: F5 apresenta e o telão vai para o segundo monitor."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=1046 "ProductName" "Lúmen"
VIAddVersionKey /LANG=1046 "FileDescription" "Lúmen — projeção para o culto"
VIAddVersionKey /LANG=1046 "FileVersion" "1.0.0"
VIAddVersionKey /LANG=1046 "ProductVersion" "1.0.0"
VIAddVersionKey /LANG=1046 "LegalCopyright" "Igreja local"
VIAddVersionKey /LANG=1046 "CompanyName" "Lúmen"

Section "Lúmen" SecApp
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${UNPACKED}/*.*"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "Software\Lúmen" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "DisplayName" "Lúmen"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "DisplayIcon" "$INSTDIR\Lúmen.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "Publisher" "Lúmen"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen" "EstimatedSize" "$0"
  CreateDirectory "$SMPROGRAMS\Lúmen"
  CreateShortCut "$SMPROGRAMS\Lúmen\Lúmen.lnk" "$INSTDIR\Lúmen.exe" "" "$INSTDIR\Lúmen.exe" 0
  CreateShortCut "$SMPROGRAMS\Lúmen\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"
  CreateShortCut "$DESKTOP\Lúmen.lnk" "$INSTDIR\Lúmen.exe" "" "$INSTDIR\Lúmen.exe" 0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Lúmen.lnk"
  RMDir /r "$SMPROGRAMS\Lúmen"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Lúmen"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lúmen"
SectionEnd
