#Requires -Version 5.1
<#
.SYNOPSIS
  Configura .env.local + Vercel Development/Preview para catering-ai-platform-DEV.
  NÃO altera Production.
  Execute em PowerShell INTERATIVO (fora do agente NonInteractive).

.NOTES
  Project Ref DEV: yasprgtlqclwsjcshtls
  PROD (proibido): eapwtirhevxrqinytans
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location 'D:\PSCS\catering-ai-platform'

$DevRef = 'yasprgtlqclwsjcshtls'
$DevUrl = "https://$DevRef.supabase.co"
$ProdRef = 'eapwtirhevxrqinytans'
$Scope = 'pscs-informatica-ltda-s-projects'

Write-Host '=== Catering AI Platform — set DEV env (interactive) ===' -ForegroundColor Cyan
Write-Host "Target DEV URL: $DevUrl"
Write-Host 'Production Vercel env will NOT be modified.'
Write-Host ''

function ConvertFrom-Secure {
  param([Security.SecureString]$Secure)
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$secPub = Read-Host -AsSecureString 'Cole Publishable Key DEV (sb_publishable_...)'
$secSvc = Read-Host -AsSecureString 'Cole Secret Key DEV (sb_secret_...)'
$pub = ConvertFrom-Secure $secPub
$svc = ConvertFrom-Secure $secSvc

if ([string]::IsNullOrWhiteSpace($pub) -or -not $pub.StartsWith('sb_publishable_')) {
  throw 'Publishable Key inválida (esperado prefixo sb_publishable_).'
}
if ([string]::IsNullOrWhiteSpace($svc) -or -not $svc.StartsWith('sb_secret_')) {
  throw 'Secret Key inválida (esperado prefixo sb_secret_).'
}

# --- Update .env.local (preserve other keys) ---
$envPath = Join-Path (Get-Location) '.env.local'
$map = [ordered]@{}
$other = New-Object System.Collections.Generic.List[string]
if (Test-Path $envPath) {
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $map[$Matches[1]] = $Matches[2]
    } else {
      [void]$other.Add($line)
    }
  }
}
$prevUrl = $map['NEXT_PUBLIC_SUPABASE_URL']
$prevRef = if ($prevUrl -match 'https://([a-z0-9]+)\.supabase\.co') { $Matches[1] } else { 'unknown' }
Write-Host "Previous Project Ref: $prevRef"
Write-Host "Correction time: $(Get-Date -Format o)"
Write-Host ('Existing var names: ' + (($map.Keys | ForEach-Object { $_ }) -join ', '))

$map['NEXT_PUBLIC_SUPABASE_URL'] = $DevUrl
$map['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = $pub
$map['SUPABASE_SERVICE_ROLE_KEY'] = $svc

$out = New-Object System.Collections.Generic.List[string]
foreach ($k in $map.Keys) { [void]$out.Add("$k=$($map[$k])") }
foreach ($l in $other) { if ($l.Trim() -ne '') { [void]$out.Add($l) } }
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($envPath, $out, $utf8NoBom)
Write-Host '.env.local updated (UTF-8 no BOM).'

# Validate without printing secrets
$checkUrl = (Select-String -Path $envPath -Pattern '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$').Matches.Groups[1].Value.Trim()
if ($checkUrl -ne $DevUrl) { throw "URL inválida após gravação: esperado DEV" }
if ($checkUrl -match $ProdRef) { throw 'ABORT: URL ainda contém PROD' }
Write-Host 'NEXT_PUBLIC_SUPABASE_URL: PRESENTE'
Write-Host 'NEXT_PUBLIC_SUPABASE_ANON_KEY: PRESENTE'
Write-Host 'SUPABASE_SERVICE_ROLE_KEY: PRESENTE'
Write-Host "PROJECT REF: $DevRef"
Write-Host 'AMBIENTE LOCAL: CATERING DEV — CORRETO'

# --- REST smoke (no data) ---
$headers = @{
  apikey = $pub
  Authorization = "Bearer $pub"
}
try {
  $resp = Invoke-WebRequest -Uri "$DevUrl/rest/v1/" -Headers $headers -Method GET -UseBasicParsing
  Write-Host "REST DEV status: $($resp.StatusCode) — alcançável=SIM auth_public=SIM"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code) {
    Write-Host "REST DEV status: $code — alcançável=SIM auth_public=PARCIAL"
  } else {
    Write-Host 'REST DEV: FALHOU (rede)'
    throw
  }
}

# --- Vercel Development + Preview only (stdin / --value via env, never Production) ---
function Set-VercelEnv {
  param([string]$Name, [string]$Value, [string]$Environment, [switch]$Sensitive)
  $args = @('vercel', 'env', 'add', $Name, $Environment, '--yes', '--scope', $Scope)
  if (-not $Sensitive) { $args += '--no-sensitive' }
  # Prefer stdin
  $Value | & npx.cmd @args
  if ($LASTEXITCODE -ne 0) {
    Write-Host "env add failed for $Name/$Environment — trying --force"
    $argsForce = @('vercel', 'env', 'add', $Name, $Environment, '--yes', '--force', '--scope', $Scope)
    if (-not $Sensitive) { $argsForce += '--no-sensitive' }
    $Value | & npx.cmd @argsForce
    if ($LASTEXITCODE -ne 0) { throw "Falha ao definir $Name em $Environment" }
  }
}

Write-Host 'Updating Vercel Development + Preview (NOT Production)...'
foreach ($envName in @('development', 'preview')) {
  Set-VercelEnv -Name 'NEXT_PUBLIC_SUPABASE_URL' -Value $DevUrl -Environment $envName
  Set-VercelEnv -Name 'NEXT_PUBLIC_SUPABASE_ANON_KEY' -Value $pub -Environment $envName
  Set-VercelEnv -Name 'SUPABASE_SERVICE_ROLE_KEY' -Value $svc -Environment $envName -Sensitive
  Write-Host "Vercel $envName: vars set (values hidden)"
}

Write-Host 'Verifying env name lists (no values):'
& npx.cmd vercel env ls development --scope $Scope
& npx.cmd vercel env ls preview --scope $Scope
& npx.cmd vercel env ls production --scope $Scope
Write-Host 'PRODUCTION: must still show only previous Production vars — do not modify.'

$pub = $null
$svc = $null
$secPub.Dispose()
$secSvc.Dispose()
[GC]::Collect()

Write-Host ''
Write-Host 'DONE. Next: npm run build && npm run dev' -ForegroundColor Green
