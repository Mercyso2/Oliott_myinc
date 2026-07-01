# Cria/atualiza o pacote cliente com bandeja em dist/MYINC-Engine-Cliente
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root
$Dest = Join-Path $Root 'dist\MYINC-Engine-Cliente'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Dest 'engine') | Out-Null

Copy-Item -Recurse -Force '.\engine\*' (Join-Path $Dest 'engine')
Copy-Item -Force '.\package.json' (Join-Path $Dest 'package.json')
if (Test-Path '.\.env.engine') { Copy-Item -Force '.\.env.engine' (Join-Path $Dest '.env.engine') }

$nodePath = (Get-Command node).Source
Copy-Item -Force $nodePath (Join-Path $Dest 'node.exe')

if (Test-Path '.\node_modules') {
  Copy-Item -Recurse -Force '.\node_modules' (Join-Path $Dest 'node_modules')
}

Copy-Item -Recurse -Force '.\engine-tray' (Join-Path $Dest 'engine-tray')
Copy-Item -Force '.\INICIAR-MYINC-ENGINE-TRAY.bat' (Join-Path $Dest 'INICIAR-MYINC-ENGINE-TRAY.bat')
Copy-Item -Force '.\INICIAR-MYINC-ENGINE-TRAY.vbs' (Join-Path $Dest 'INICIAR-MYINC-ENGINE-TRAY.vbs')
Copy-Item -Force '.\INSTALAR-INICIAR-COM-WINDOWS.bat' (Join-Path $Dest 'INSTALAR-INICIAR-COM-WINDOWS.bat')
Copy-Item -Force '.\REMOVER-INICIAR-COM-WINDOWS.bat' (Join-Path $Dest 'REMOVER-INICIAR-COM-WINDOWS.bat')

@"
MYINC ENGINE TRAY

1. Clique em INICIAR-MYINC-ENGINE-TRAY.bat.
2. O icone da MYINC aparece perto do relogio do Windows.
3. Clique com o botao direito no icone para abrir painel, reiniciar, parar ou ver logs.
4. Para iniciar automaticamente com o Windows, clique em INSTALAR-INICIAR-COM-WINDOWS.bat.
5. Nao apague o arquivo .env.engine.

"@ | Out-File -Encoding UTF8 (Join-Path $Dest 'README_CLIENTE.txt')

$Zip = Join-Path $Root 'dist\MYINC-Engine-Cliente-Tray.zip'
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $Dest '*') -DestinationPath $Zip -Force
Write-Host "Pacote criado:" $Zip
