import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = join(root, "dist-desktop");
const unpackedDir = join(outDir, "win-unpacked");
const appDir = join(unpackedDir, "resources", "app");
const productExe = join(unpackedDir, "MYINC Social Media AI.exe");
const zipPath = join(outDir, "MYINC Social Media AI - Instalador Cliente.zip");

function fail(message) {
  console.error(`[package-client] ${message}`);
  process.exit(1);
}

function copyDir(from, to) {
  if (!existsSync(from)) fail(`Origem ausente: ${from}`);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

function copyFile(from, to) {
  if (!existsSync(from)) fail(`Arquivo ausente: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

function find7za() {
  const base =
    process.env.LOCALAPPDATA &&
    join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "7zip@1.0.0");
  if (!base || !existsSync(base)) return null;
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSafe(current)) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      if (entry.isFile() && entry.name.toLowerCase() === "7za.exe") return path;
    }
  }
  return null;
}

function readdirSafe(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function ensureElectronRuntime() {
  const electronDist = join(root, "node_modules", "electron", "dist");
  if (!existsSync(join(unpackedDir, "electron.exe"))) {
    copyDir(electronDist, unpackedDir);
  }
  if (!existsSync(productExe)) {
    copyFile(join(unpackedDir, "electron.exe"), productExe);
  }
}

function writeInstaller() {
  const installerPath = join(outDir, "Instalar MYINC Social Media AI.cmd");
  const installerPs1Path = join(outDir, "Instalar MYINC Social Media AI.ps1");
  writeFileSync(
    installerPath,
    `@echo off
setlocal
title Instalador - MYINC Social Media AI
set "SCRIPT_DIR=%~dp0"
set "INSTALL_PS1=%SCRIPT_DIR%Instalar MYINC Social Media AI.ps1"

if not exist "%INSTALL_PS1%" (
  echo ERRO: Arquivo "Instalar MYINC Social Media AI.ps1" nao encontrado.
  echo Extraia o ZIP completo antes de instalar.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_PS1%"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Instalacao falhou. Veja o log em:
  echo %LOCALAPPDATA%\\MYINC Social Media AI\\install.log
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Instalacao concluida com sucesso.
pause
`,
    "ascii",
  );
  writeFileSync(
    installerPs1Path,
    `$ErrorActionPreference = 'Stop'

$appName = 'MYINC Social Media AI'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appSource = Join-Path $scriptDir 'win-unpacked'
$installDir = Join-Path $env:LOCALAPPDATA "Programs\\$appName"
$logDir = Join-Path $env:LOCALAPPDATA $appName
$logPath = Join-Path $logDir 'install.log'
$exeName = "$appName.exe"
$sourceExe = Join-Path $appSource $exeName
$targetExe = Join-Path $installDir $exeName

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"[$(Get-Date -Format s)] Inicio da instalacao" | Set-Content -Encoding UTF8 $logPath

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
  "[$(Get-Date -Format s)] $Message" | Add-Content -Encoding UTF8 $logPath
}

try {
  if (-not (Test-Path $sourceExe)) {
    throw "Pasta win-unpacked ou executavel nao encontrado. Extraia o ZIP completo antes de instalar."
  }

  Write-Step 'Fechando aplicativo aberto, se existir'
  Get-Process -Name $appName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  Write-Step 'Preparando pasta de instalacao'
  if (Test-Path $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null

  Write-Step 'Copiando arquivos do aplicativo. Esta etapa pode levar alguns minutos'
  $roboLog = Join-Path $logDir 'robocopy.log'
  $robocopyArgs = @(
    $appSource,
    $installDir,
    '/MIR',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/MT:8',
    '/TEE',
    "/LOG+:$roboLog"
  )
  & robocopy @robocopyArgs
  $copyCode = $LASTEXITCODE
  "[$(Get-Date -Format s)] Robocopy exit code: $copyCode" | Add-Content -Encoding UTF8 $logPath
  if ($copyCode -ge 8) {
    throw "Falha ao copiar arquivos. Codigo robocopy: $copyCode"
  }

  if (-not (Test-Path $targetExe)) {
    throw "Executavel instalado nao encontrado em $targetExe"
  }

  Write-Step 'Criando atalhos'
  $desktop = [Environment]::GetFolderPath('DesktopDirectory')
  $programs = [Environment]::GetFolderPath('Programs')
  $menuDir = Join-Path $programs $appName
  New-Item -ItemType Directory -Force -Path $menuDir | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  foreach ($shortcutPath in @((Join-Path $desktop "$appName.lnk"), (Join-Path $menuDir "$appName.lnk"))) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetExe
    $shortcut.WorkingDirectory = $installDir
    $shortcut.IconLocation = $targetExe
    $shortcut.Save()
  }

  Write-Step 'Registrando desinstalador'
  $uninstaller = Join-Path $installDir "Desinstalar $appName.cmd"
  $uninstallScript = @"
@echo off
taskkill /IM "$exeName" /F >nul 2>nul
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$appName" /f >nul 2>nul
rmdir /S /Q "$installDir"
del "%USERPROFILE%\\Desktop\\$appName.lnk" >nul 2>nul
rmdir /S /Q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\$appName" >nul 2>nul
echo $appName removido.
pause
"@
  Set-Content -Encoding ASCII -Path $uninstaller -Value $uninstallScript

  $regPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$appName"
  New-Item -Force -Path $regPath | Out-Null
  New-ItemProperty -Force -Path $regPath -Name DisplayName -Value $appName | Out-Null
  New-ItemProperty -Force -Path $regPath -Name DisplayIcon -Value $targetExe | Out-Null
  New-ItemProperty -Force -Path $regPath -Name InstallLocation -Value $installDir | Out-Null
  New-ItemProperty -Force -Path $regPath -Name UninstallString -Value $uninstaller | Out-Null
  New-ItemProperty -Force -Path $regPath -Name Publisher -Value 'MYINC' | Out-Null

  Write-Step 'Abrindo aplicativo'
  Start-Process -FilePath $targetExe -WorkingDirectory $installDir

  Write-Host ''
  Write-Host 'Instalacao finalizada com sucesso.' -ForegroundColor Green
  Write-Host "Log: $logPath"
  "[$(Get-Date -Format s)] Instalacao finalizada com sucesso" | Add-Content -Encoding UTF8 $logPath
  exit 0
} catch {
  Write-Host ''
  Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
  "[$(Get-Date -Format s)] ERRO: $($_.Exception.Message)" | Add-Content -Encoding UTF8 $logPath
  exit 1
}
`,
    "ascii",
  );
}

ensureElectronRuntime();
copyDir(join(root, "dist"), join(appDir, "dist"));
copyDir(join(root, "electron"), join(appDir, "electron"));
copyDir(join(root, "engine"), join(appDir, "engine"));
copyDir(join(root, "assets"), join(appDir, "assets"));
copyDir(join(root, "templates"), join(appDir, "templates"));
copyFile(join(root, "package.json"), join(appDir, "package.json"));
copyFile(join(root, "package-lock.json"), join(appDir, "package-lock.json"));
copyFile(
  join(root, ".env.engine.example"),
  join(unpackedDir, ".env.engine.example"),
);
if (
  process.env.MYINC_INCLUDE_ENGINE_ENV === "true" &&
  existsSync(join(root, ".env.engine"))
) {
  copyFile(join(root, ".env.engine"), join(unpackedDir, ".env.engine"));
}

const appNodeModules = join(appDir, "node_modules");
rmSync(appNodeModules, { recursive: true, force: true });
copyDir(
  join(root, "node_modules", "ffmpeg-static"),
  join(appNodeModules, "ffmpeg-static"),
);
copyDir(join(root, "node_modules", "sharp"), join(appNodeModules, "sharp"));
copyDir(join(root, "node_modules", "@img"), join(appNodeModules, "@img"));

writeInstaller();

const sevenZip = find7za();
if (sevenZip) {
  rmSync(zipPath, { force: true });
  const result = spawnSync(
    sevenZip,
    [
      "a",
      "-tzip",
      "-mx=0",
      "-mmt=on",
      zipPath,
      "win-unpacked",
      "Instalar MYINC Social Media AI.cmd",
      "Instalar MYINC Social Media AI.ps1",
    ],
    {
      cwd: outDir,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) fail(`7-Zip falhou com codigo ${result.status}`);
  const test = spawnSync(sevenZip, ["t", zipPath], { stdio: "inherit" });
  if (test.status !== 0) fail(`Teste do ZIP falhou com codigo ${test.status}`);
  console.log(
    `[package-client] ZIP pronto: ${zipPath} (${Math.round(statSync(zipPath).size / 1024 / 1024)} MB)`,
  );
} else {
  console.log(
    `[package-client] 7za.exe nao encontrado. Pasta pronta: ${outDir}`,
  );
}
