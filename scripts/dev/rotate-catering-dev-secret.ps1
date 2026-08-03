#Requires -Version 5.1
<#
.SYNOPSIS
  Rotaciona somente SUPABASE_SERVICE_ROLE_KEY do Catering DEV
  (.env.local + Vercel Development/Preview). NAO altera Production.
  NAO altera Publishable Key nem URL.
  Execute em PowerShell INTERATIVO (o agente Cursor e NonInteractive).

.NOTES
  Project Ref DEV correto: yasprgtlqclwsjcshtls
  PROD (proibido): eapwtirhevxrqinytans
  Status (sem segredos): scripts/dev/.rotate-secret-status.json
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location 'D:\PSCS\catering-ai-platform'

$DevRef = 'yasprgtlqclwsjcshtls'
$DevUrlExpected = "https://$DevRef.supabase.co"
$ProdRef = 'eapwtirhevxrqinytans'
$Scope = 'pscs-informatica-ltda-s-projects'
$Project = 'catering-ai-platform'
$StatusPath = Join-Path (Get-Location) 'scripts\dev\.rotate-secret-status.json'
$envPath = Join-Path (Get-Location) '.env.local'

function Write-Status([hashtable]$Data) {
  $dir = Split-Path -Parent $StatusPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  ($Data | ConvertTo-Json -Compress) | Set-Content -LiteralPath $StatusPath -Encoding utf8
}

function ConvertFrom-Secure {
  param([Security.SecureString]$Secure)
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Get-EnvMap {
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
  return @{ Map = $map; Other = $other }
}

Write-Host ''
Write-Host '=== Catering AI Platform - ROTACAO SECRET KEY DEV ===' -ForegroundColor Cyan
Write-Host "DEV esperado: $DevUrlExpected"
Write-Host 'Production Vercel NAO sera alterada.'
Write-Host 'Publishable Key e URL serao preservadas.'
Write-Host ''

if (-not (Test-Path $envPath)) {
  Write-Status @{ ok = $false; stage = 'precheck'; error = 'missing_env_local' }
  throw '.env.local ausente'
}

$parsed = Get-EnvMap
$map = $parsed.Map
$other = $parsed.Other
$url = [string]$map['NEXT_PUBLIC_SUPABASE_URL']
$anon = [string]$map['NEXT_PUBLIC_SUPABASE_ANON_KEY']
$ref = if ($url -match 'https://([a-z0-9]+)\.supabase\.co') { $Matches[1] } else { 'none' }

if ($ref -eq $ProdRef) {
  Write-Status @{ ok = $false; stage = 'precheck'; error = 'points_to_prod' }
  throw 'BLOQUEADO - CONFIGURACAO LOCAL APONTA PARA PROD'
}
if ($ref -ne $DevRef) {
  Write-Status @{ ok = $false; stage = 'precheck'; error = 'unexpected_ref'; ref = $ref }
  throw "BLOQUEADO - Project Ref local inesperado: $ref (esperado $DevRef)"
}
if ([string]::IsNullOrWhiteSpace($anon) -or -not $anon.StartsWith('sb_publishable_')) {
  Write-Status @{ ok = $false; stage = 'precheck'; error = 'publishable_invalid' }
  throw 'BLOQUEADO - NEXT_PUBLIC_SUPABASE_ANON_KEY ausente/invalida'
}

Write-Host "PROJECT REF local: $ref - CATERING DEV OK"
Write-Host 'Publishable: PRESENTE (preservada)'
Write-Host ''

# --- Prompt oculto (pode pedir 2x se invalida) ---
$svc = $null
for ($i = 1; $i -le 2; $i++) {
  $sec = Read-Host -AsSecureString 'Cole a NOVA SECRET KEY do Catering DEV (sb_secret_...)'
  $candidate = ConvertFrom-Secure $sec
  try { $sec.Dispose() } catch {}
  if ($candidate -and $candidate.StartsWith('sb_secret_') -and $candidate.Length -gt 20) {
    $svc = $candidate
    $candidate = $null
    break
  }
  Write-Host 'Secret invalida (precisa comecar com sb_secret_). Tente novamente.' -ForegroundColor Yellow
  $candidate = $null
}
if (-not $svc) {
  Write-Status @{ ok = $false; stage = 'prompt'; error = 'invalid_secret' }
  throw 'BLOQUEADO - Secret Key invalida apos 2 tentativas'
}

# --- Atualiza somente a secret no .env.local ---
$map['SUPABASE_SERVICE_ROLE_KEY'] = $svc
$out = New-Object System.Collections.Generic.List[string]
foreach ($k in $map.Keys) { [void]$out.Add("$k=$($map[$k])") }
foreach ($l in $other) { if ($l.Trim() -ne '') { [void]$out.Add($l) } }
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($envPath, $out.ToArray(), $utf8NoBom)

# Re-validate without printing values
$after = Get-EnvMap
$aUrl = [string]$after.Map['NEXT_PUBLIC_SUPABASE_URL']
$aAnon = [string]$after.Map['NEXT_PUBLIC_SUPABASE_ANON_KEY']
$aSvc = [string]$after.Map['SUPABASE_SERVICE_ROLE_KEY']
$aRef = if ($aUrl -match 'https://([a-z0-9]+)\.supabase\.co') { $Matches[1] } else { 'none' }
if ($aRef -eq $ProdRef) { throw 'ABORT: URL aponta PROD apos gravacao' }
if ($aRef -ne $DevRef) { throw 'ABORT: URL nao e DEV apos gravacao' }
if (-not $aAnon.StartsWith('sb_publishable_')) { throw 'ABORT: publishable perdida' }
if (-not $aSvc.StartsWith('sb_secret_')) { throw 'ABORT: secret nao gravada' }

Write-Host 'NEXT_PUBLIC_SUPABASE_URL: PRESENTE'
Write-Host 'NEXT_PUBLIC_SUPABASE_ANON_KEY: PRESENTE'
Write-Host 'SUPABASE_SERVICE_ROLE_KEY: PRESENTE'
Write-Host "PROJECT REF: $aRef"
Write-Host 'AMBIENTE LOCAL: CATERING DEV - CORRETO'
Write-Host '.env.local atualizado (UTF-8 sem BOM). Somente a Secret Key foi alterada.'

# --- Smoke server-side (sem imprimir dados) ---
$serverOk = $false
$code = $null
try {
  $headers = @{
    apikey = $svc
    Authorization = "Bearer $svc"
  }
  $resp = Invoke-WebRequest -Uri "$DevUrlExpected/rest/v1/" -Headers $headers -Method GET -UseBasicParsing
  $code = [int]$resp.StatusCode
} catch {
  try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = $null }
}

if ($code -eq 401 -or $code -eq 403) {
  $serverOk = $false
} elseif ($null -ne $code) {
  $serverOk = $true
}

Write-Host "REST status (sem dados): $code"
if ($serverOk) {
  Write-Host 'SUPABASE DEV SERVER CONNECTION: OK' -ForegroundColor Green
} else {
  Write-Host 'SUPABASE DEV SERVER CONNECTION: FALHOU' -ForegroundColor Red
  Write-Status @{
    ok = $false
    stage = 'local_test'
    error = 'server_connection_failed'
    local_ref = $aRef
    secret_present = $true
    http = $code
  }
  $svc = $null
  $aSvc = $null
  [GC]::Collect()
  throw 'BLOQUEADO - nova Secret Key nao autenticou no DEV'
}

# Clear secret from memory before Vercel re-prompt (per playbook)
$svc = $null
$aSvc = $null
[GC]::Collect()

Write-Host ''
Write-Host '--- Vercel: cole novamente a NOVA SECRET KEY (prompt oculto) ---' -ForegroundColor Cyan
$svc = $null
for ($i = 1; $i -le 2; $i++) {
  $sec = Read-Host -AsSecureString 'Cole novamente a NOVA SECRET KEY do Catering DEV para atualizar a Vercel'
  $candidate = ConvertFrom-Secure $sec
  try { $sec.Dispose() } catch {}
  if ($candidate -and $candidate.StartsWith('sb_secret_') -and $candidate.Length -gt 20) {
    $svc = $candidate
    $candidate = $null
    break
  }
  Write-Host 'Secret invalida. Tente novamente.' -ForegroundColor Yellow
  $candidate = $null
}
if (-not $svc) {
  Write-Status @{ ok = $false; stage = 'vercel_prompt'; error = 'invalid_secret'; local_updated = $true }
  throw 'BLOQUEADO - Secret invalida para Vercel'
}

function Update-VercelSecret {
  param([string]$Environment, [string]$Value, [switch]$Sensitive)
  $argList = @(
    'vercel', 'env', 'update', 'SUPABASE_SERVICE_ROLE_KEY', $Environment,
    '--yes',
    '--scope', $Scope,
    '--project', $Project
  )
  if ($Sensitive) { $argList += '--sensitive' }
  Write-Host "Updating SUPABASE_SERVICE_ROLE_KEY @ $Environment (stdin, value hidden)..."
  $Value | & npx.cmd @argList
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'update falhou - tentando env add --force...'
    $addArgs = @(
      'vercel', 'env', 'add', 'SUPABASE_SERVICE_ROLE_KEY', $Environment,
      '--yes', '--force',
      '--scope', $Scope,
      '--project', $Project
    )
    if ($Sensitive) { $addArgs += '--sensitive' } else { $addArgs += '--no-sensitive' }
    $Value | & npx.cmd @addArgs
    if ($LASTEXITCODE -ne 0) { throw "Falha ao definir secret em $Environment" }
  }
}

# Development: --sensitive NAO permitido
Update-VercelSecret -Environment 'development' -Value $svc
# Preview: sensitive OK
Update-VercelSecret -Environment 'preview' -Value $svc -Sensitive

$svc = $null
[GC]::Collect()

Write-Host ''
Write-Host '=== Vercel env ls (nomes apenas) ==='
& npx.cmd vercel env ls --scope $Scope --project $Project

Write-Status @{
  ok = $true
  stage = 'done'
  local_ref = $DevRef
  local_secret = 'PRESENTE'
  publishable_preserved = $true
  url_preserved = $true
  vercel_development = 'UPDATED_SECRET'
  vercel_preview = 'UPDATED_SECRET'
  vercel_production = 'NOT_TOUCHED'
  server_connection = 'OK'
  completed_at = (Get-Date -Format o)
}

Write-Host ''
Write-Host 'ROTACAO LOCAL+VERCEL CONCLUIDA.' -ForegroundColor Green
Write-Host 'Production NAO foi alterada.'
Write-Host 'NAO apague a Secret antiga no Supabase ate validar o Preview.'
Write-Host 'Feche esta janela. O agente pode continuar build/smoke/preview.'
Write-Host ''
Read-Host 'Pressione Enter para fechar'
