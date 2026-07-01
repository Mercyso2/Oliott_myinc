@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $target=(Resolve-Path '.\INICIAR-MYINC-ENGINE-TRAY.vbs').Path; $shortcut=Join-Path $startup 'MYINC Engine Tray.lnk'; $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut($shortcut); $s.TargetPath='wscript.exe'; $s.Arguments='""'+$target+'""'; $s.WorkingDirectory=(Get-Location).Path; $s.IconLocation=(Resolve-Path '.\engine-tray\assets\myinc-engine.ico').Path; $s.Description='MYINC Engine em segundo plano'; $s.Save(); Write-Host 'Inicializacao instalada:' $shortcut"
echo.
echo Pronto. O MYINC Engine Tray vai abrir automaticamente com o Windows.
pause
