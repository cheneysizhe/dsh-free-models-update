# DSH OpenRouter 免费模型插件 — 安装脚本（幂等：重复运行安全）
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'dsh-free-models-update'
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $homeDir 'profiles\desktop'
$nmDir = Join-Path $homeDir 'profiles\node_modules'
$pkgDir = Join-Path $nmDir 'dsh-free-models-update'
$patch = Join-Path $profileDir 'cordis.patch.yml'

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  DSH OpenRouter 免费模型插件 · 安装' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $profileDir)) {
  Write-Host "[错误] 未找到 DSH profile 目录: $profileDir" -ForegroundColor Red
  Write-Host '       请确认已安装并运行过 DSH Desktop。' -ForegroundColor Yellow
  exit 1
}
Write-Host "[1/3] DSH 配置目录: $homeDir"

if (Test-Path $pkgDir) {
  Write-Host '[2/3] 插件已存在，跳过复制。' -ForegroundColor Yellow
} else {
  if (-not (Test-Path $nmDir)) { New-Item -ItemType Directory -Path $nmDir -Force | Out-Null }
  Copy-Item -Recurse -Force $src $pkgDir
  Write-Host "[2/3] 插件已安装到: $pkgDir"
}

if (Test-Path $patch) {
  $raw = [System.IO.File]::ReadAllText($patch, [System.Text.Encoding]::UTF8)
  if ($raw -match 'id:\s*free-models-update') {
    Write-Host '[3/3] cordis.patch.yml 已包含插件条目，跳过。' -ForegroundColor Yellow
  } else {
    $add = "`r`n- insert:`r`n    - id: free-models-update`r`n      name: 'dsh-free-models-update'`r`n      config: {}`r`n"
    [System.IO.File]::AppendAllText($patch, $add, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host '[3/3] 已向 cordis.patch.yml 追加插件条目。'
  }
} else {
  if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
  $content = "# DSH user patch layer`r`n- insert:`r`n    - id: free-models-update`r`n      name: 'dsh-free-models-update'`r`n      config: {}`r`n"
  [System.IO.File]::WriteAllText($patch, $content, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host '[3/3] 已创建 cordis.patch.yml 并写入插件条目。'
}

Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host '  安装完成！请完全退出并重启 DSH Desktop' -ForegroundColor Green
Write-Host '  重启后：设置 → 左侧导航「免费模型」' -ForegroundColor Green
Write-Host '  → 粘贴你自己的 OpenRouter Key → 一键更新' -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Green
Write-Host ''
