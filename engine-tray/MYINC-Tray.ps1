# MYINC Engine Tray V7.0
# Mantém o motor local rodando em segundo plano com ícone na bandeja do Windows.
# Não coloque chaves aqui; as chaves continuam no .env.engine.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$IconPath = Join-Path $ScriptDir "assets\myinc-engine.ico"
$EnvPath = Join-Path $BaseDir ".env.engine"
$EnginePath = Join-Path $BaseDir "engine\runtime\main-loop.mjs"
$LocalNode = Join-Path $BaseDir "node.exe"
$NodeExe = if (Test-Path $LocalNode) { $LocalNode } else { "node" }
$LogsDir = Join-Path $BaseDir "logs"
$PidFile = Join-Path $LogsDir "myinc-engine.pid"
$OutLog = Join-Path $LogsDir "myinc-engine.out.log"
$ErrLog = Join-Path $LogsDir "myinc-engine.err.log"
$PanelUrl = "http://localhost:5173"
$global:EngineProcess = $null
$global:LastStatus = "Iniciando..."

if (!(Test-Path $LogsDir)) { New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null }

function Read-EnvValue([string]$Key, [string]$Fallback) {
  if (!(Test-Path $EnvPath)) { return $Fallback }
  $line = Get-Content $EnvPath -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (!$line) { return $Fallback }
  $value = ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
  if ([string]::IsNullOrWhiteSpace($value)) { return $Fallback }
  return $value
}

$PanelUrl = Read-EnvValue "MYINC_PANEL_URL" (Read-EnvValue "VITE_APP_URL" (Read-EnvValue "PANEL_URL" "http://localhost:5173"))

function Test-EngineRunning {
  if ($global:EngineProcess -and !$global:EngineProcess.HasExited) { return $true }
  if (Test-Path $PidFile) {
    try {
      $pidValue = [int](Get-Content $PidFile -ErrorAction Stop | Select-Object -First 1)
      $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
      if ($proc) {
        $global:EngineProcess = $proc
        return $true
      }
    } catch {}
  }
  return $false
}

function Write-Status([string]$Status) {
  $global:LastStatus = $Status
  if ($script:NotifyIcon) {
    $short = if ($Status.Length -gt 55) { $Status.Substring(0, 55) + "..." } else { $Status }
    $script:NotifyIcon.Text = "MYINC Engine - $short"
  }
  if ($script:StatusItem) { $script:StatusItem.Text = "Status: $Status" }
}

function Show-Balloon([string]$Title, [string]$Text, [string]$Icon = "Info") {
  if ($script:NotifyIcon) {
    $script:NotifyIcon.BalloonTipTitle = $Title
    $script:NotifyIcon.BalloonTipText = $Text
    $script:NotifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::$Icon
    $script:NotifyIcon.ShowBalloonTip(3000)
  }
}

function Start-Engine {
  if (Test-EngineRunning) {
    Write-Status "Online"
    Show-Balloon "MYINC Engine" "O motor já está rodando." "Info"
    return
  }
  if (!(Test-Path $EnginePath)) {
    Write-Status "Erro: motor não encontrado"
    Show-Balloon "MYINC Engine" "Arquivo engine/runtime/main-loop.mjs não encontrado." "Error"
    return
  }
  if (!(Test-Path $EnvPath)) {
    Write-Status "Erro: .env.engine ausente"
    Show-Balloon "MYINC Engine" "Arquivo .env.engine não encontrado na pasta do motor." "Error"
    return
  }
  try {
    Add-Content -Path $OutLog -Value "`n===== START $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="
    Add-Content -Path $ErrLog -Value "`n===== START $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="
    $proc = Start-Process -FilePath $NodeExe -ArgumentList @($EnginePath) -WorkingDirectory $BaseDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog
    $global:EngineProcess = $proc
    Set-Content -Path $PidFile -Value $proc.Id
    Write-Status "Online"
    Show-Balloon "MYINC Engine" "Motor iniciado em segundo plano." "Info"
  } catch {
    Write-Status "Erro ao iniciar"
    Add-Content -Path $ErrLog -Value $_.Exception.Message
    Show-Balloon "MYINC Engine" "Falha ao iniciar: $($_.Exception.Message)" "Error"
  }
}

function Stop-Engine {
  try {
    if (Test-EngineRunning) {
      $global:EngineProcess.Kill()
      $global:EngineProcess.WaitForExit(3000) | Out-Null
      $global:EngineProcess = $null
    }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
    Write-Status "Parado"
    Show-Balloon "MYINC Engine" "Motor parado." "Info"
  } catch {
    Write-Status "Erro ao parar"
    Show-Balloon "MYINC Engine" "Falha ao parar: $($_.Exception.Message)" "Error"
  }
}

function Restart-Engine {
  Stop-Engine
  Start-Sleep -Seconds 1
  Start-Engine
}

function Open-Panel { Start-Process $PanelUrl }
function Open-LogsFolder { Start-Process explorer.exe $LogsDir }
function Open-OutLog { if (!(Test-Path $OutLog)) { New-Item -ItemType File -Force -Path $OutLog | Out-Null }; Start-Process notepad.exe $OutLog }
function Open-ErrLog { if (!(Test-Path $ErrLog)) { New-Item -ItemType File -Force -Path $ErrLog | Out-Null }; Start-Process notepad.exe $ErrLog }

$script:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
$script:NotifyIcon.Icon = New-Object System.Drawing.Icon($IconPath)
$script:NotifyIcon.Visible = $true
$script:NotifyIcon.Text = "MYINC Engine"

$Menu = New-Object System.Windows.Forms.ContextMenuStrip
$script:StatusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:StatusItem.Text = "Status: Iniciando..."
$script:StatusItem.Enabled = $false
[void]$Menu.Items.Add($script:StatusItem)
[void]$Menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$ItemOpenPanel = New-Object System.Windows.Forms.ToolStripMenuItem("Abrir painel")
$ItemOpenPanel.Add_Click({ Open-Panel })
[void]$Menu.Items.Add($ItemOpenPanel)

$ItemStart = New-Object System.Windows.Forms.ToolStripMenuItem("Iniciar motor")
$ItemStart.Add_Click({ Start-Engine })
[void]$Menu.Items.Add($ItemStart)

$ItemRestart = New-Object System.Windows.Forms.ToolStripMenuItem("Reiniciar motor")
$ItemRestart.Add_Click({ Restart-Engine })
[void]$Menu.Items.Add($ItemRestart)

$ItemStop = New-Object System.Windows.Forms.ToolStripMenuItem("Parar motor")
$ItemStop.Add_Click({ Stop-Engine })
[void]$Menu.Items.Add($ItemStop)

[void]$Menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$ItemLogs = New-Object System.Windows.Forms.ToolStripMenuItem("Abrir pasta de logs")
$ItemLogs.Add_Click({ Open-LogsFolder })
[void]$Menu.Items.Add($ItemLogs)

$ItemOutLog = New-Object System.Windows.Forms.ToolStripMenuItem("Ver log principal")
$ItemOutLog.Add_Click({ Open-OutLog })
[void]$Menu.Items.Add($ItemOutLog)

$ItemErrLog = New-Object System.Windows.Forms.ToolStripMenuItem("Ver log de erros")
$ItemErrLog.Add_Click({ Open-ErrLog })
[void]$Menu.Items.Add($ItemErrLog)

[void]$Menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$ItemExit = New-Object System.Windows.Forms.ToolStripMenuItem("Sair e parar motor")
$ItemExit.Add_Click({
  Stop-Engine
  $script:NotifyIcon.Visible = $false
  $script:NotifyIcon.Dispose()
  [System.Windows.Forms.Application]::Exit()
})
[void]$Menu.Items.Add($ItemExit)

$script:NotifyIcon.ContextMenuStrip = $Menu
$script:NotifyIcon.Add_DoubleClick({ Open-Panel })

$Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 5000
$Timer.Add_Tick({
  if (Test-EngineRunning) {
    Write-Status "Online"
  } else {
    Write-Status "Parado"
  }
})
$Timer.Start()

Start-Engine
$Context = New-Object System.Windows.Forms.ApplicationContext
[System.Windows.Forms.Application]::Run($Context)
