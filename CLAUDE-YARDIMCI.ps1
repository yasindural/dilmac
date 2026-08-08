param(
  [string]$TaskFile = "claude-task.local.json"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskPath = Join-Path $projectRoot $TaskFile

if (-not (Test-Path -LiteralPath $taskPath)) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "claude-task.example.json") -Destination $taskPath
  Write-Host "Görev dosyası oluşturuldu: $taskPath"
  Write-Host "Önce bu dosyadaki görevi ve dosya listesini düzenleyip tekrar çalıştırın."
  exit 0
}

$secureKey = Read-Host "OpenRouter anahtarını girin (ekranda görünmez)" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:OPENROUTER_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  & node (Join-Path $projectRoot "tools\claude-worker.mjs") $taskPath
  if ($LASTEXITCODE -ne 0) { throw "Claude yardımcı işlemi başarısız oldu." }
}
finally {
  Remove-Item Env:OPENROUTER_API_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
