# DSH OpenRouter 免费模型插件 — 卸载脚本
$ErrorActionPreference = 'Stop'
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$pkgDir = Join-Path $homeDir 'profiles\node_modules\dsh-free-models-update'
$patch = Join-Path $homeDir 'profiles\desktop\cordis.patch.yml'

Write-Host '== DSH OpenRouter 免费模型插件 · 卸载 ==' -ForegroundColor Cyan

if (Test-Path $pkgDir) {
  Remove-Item -Recurse -Force $pkgDir
  Write-Host "[1/2] 已删除插件目录: $pkgDir"
} else {
  Write-Host '[1/2] 插件目录不存在，跳过。' -ForegroundColor Yellow
}

if (Test-Path $patch) {
  $raw = [System.IO.File]::ReadAllText($patch, [System.Text.Encoding]::UTF8)
  $pattern = '(?m)^- insert:\r?\n\s{4}- id: free-models-update\r?\n\s{6}name: ''dsh-free-models-update''\r?\n\s{6}config: \{\}\r?\n?'
  $new = [regex]::Replace($raw, $pattern, '')
  if ($new -ne $raw) {
    [System.IO.File]::WriteAllText($patch, $new, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host '[2/2] 已从 cordis.patch.yml 移除插件条目。'
  } else {
    Write-Host '[2/2] patch 中未找到插件条目，跳过。' -ForegroundColor Yellow
  }
} else {
  Write-Host '[2/2] 未找到 cordis.patch.yml，跳过。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '卸载完成。重启 DSH Desktop 后插件将不再加载。' -ForegroundColor Green
Write-Host '（插件本身不保存任何密钥；你的 OpenRouter Key 仍保留在 ~/.dsh/.credentials.yaml）'
Write-Host ''
