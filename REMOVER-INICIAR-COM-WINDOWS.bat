@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $shortcut=Join-Path $startup 'MYINC Engine Tray.lnk'; if(Test-Path $shortcut){Remove-Item $shortcut -Force; Write-Host 'Atalho removido:' $shortcut}else{Write-Host 'Atalho nao encontrado.'}"
echo.
echo Pronto. O MYINC Engine Tray nao vai mais iniciar com o Windows.
pause
