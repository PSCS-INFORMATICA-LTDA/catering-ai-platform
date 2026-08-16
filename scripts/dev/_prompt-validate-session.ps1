#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location 'D:\PSCS\catering-ai-platform'

$statusPath = 'scripts\dev\.session-validate-status.json'

function Write-Status([hashtable]$Data) {
  ($Data | ConvertTo-Json -Compress) | Set-Content -LiteralPath $statusPath -Encoding utf8
}

Write-Host ''
Write-Host '=== Validacao de sessao DEV (senha oculta) ===' -ForegroundColor Cyan
Write-Host 'Project: catering-ai-platform-DEV'
Write-Host 'Usuario: philippe.dev@pscsinformatica.com.br'
Write-Host ''

$sec = Read-Host -AsSecureString 'Cole a senha do usuario Auth DEV (oculta)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  try { $sec.Dispose() } catch {}
}

if ([string]::IsNullOrWhiteSpace($plain)) {
  Write-Status @{ ok = $false; error = 'empty_password' }
  Write-Host 'Senha vazia.' -ForegroundColor Red
  exit 1
}

$env:CATERING_DEV_USER_PASSWORD = $plain
$plain = $null

Write-Host 'Executando --validate-session...'
& node scripts/dev/_membership-philippe-dev.mjs --validate-session --password-env CATERING_DEV_USER_PASSWORD
$code = $LASTEXITCODE

Remove-Item Env:CATERING_DEV_USER_PASSWORD -ErrorAction SilentlyContinue
[GC]::Collect()

Write-Status @{
  ok = ($code -eq 0)
  exit_code = $code
  completed_at = (Get-Date -Format o)
}

Write-Host "SESSION_EXIT=$code"
if ($code -ne 0) { exit $code }
Read-Host 'Pressione Enter para fechar'
