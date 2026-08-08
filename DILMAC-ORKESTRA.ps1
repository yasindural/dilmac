$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputRoot = Join-Path $projectRoot ".orchestra-output"
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$runLog = Join-Path $outputRoot "run.log"
Set-Content -LiteralPath $runLog -Value "Dilmaç orkestrası başlatıldı: $(Get-Date -Format o)"
$secureKey = Read-Host "OpenRouter anahtarını girin (ekranda görünmez)" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:OPENROUTER_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  & node (Join-Path $projectRoot "tools\dilmac-orchestra.mjs") (Join-Path $projectRoot "orchestra-plan.json") *>> $runLog
  if ($LASTEXITCODE -ne 0) { throw "Dilmaç orkestrası başarısız oldu." }
  Write-Host "Orkestra tamamlandı. Rapor: $outputRoot\conductor-report.md"
}
catch {
  Add-Content -LiteralPath $runLog -Value "HATA: $($_.Exception.Message)"
  Write-Host "Orkestra tamamlanamadı. Hata kaydı: $runLog" -ForegroundColor Red
}
finally {
  Remove-Item Env:OPENROUTER_API_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
