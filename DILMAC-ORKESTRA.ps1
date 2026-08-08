$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$secureKey = Read-Host "OpenRouter anahtarını girin (ekranda görünmez)" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:OPENROUTER_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  & node (Join-Path $projectRoot "tools\dilmac-orchestra.mjs") (Join-Path $projectRoot "orchestra-plan.json")
  if ($LASTEXITCODE -ne 0) { throw "Dilmaç orkestrası başarısız oldu." }
}
finally {
  Remove-Item Env:OPENROUTER_API_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
