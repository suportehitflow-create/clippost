# Deploy do backend sem derrubar cortes em andamento.
# Espera /api/admin/active-jobs zerar e só então roda `fly deploy`.
# Uso:  powershell -ExecutionPolicy Bypass -File backend\deploy.ps1 [-MaxWaitMinutes 30]
param([int]$MaxWaitMinutes = 30)

$ErrorActionPreference = "Stop"
$fly = (Get-Command flyctl -ErrorAction SilentlyContinue).Source
if (-not $fly) { $fly = (Get-Command fly -ErrorAction SilentlyContinue).Source }
if (-not $fly) { $fly = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe" }

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
while ($true) {
    $status = $null
    try {
        $status = Invoke-RestMethod -Uri "https://clippost-backend.fly.dev/api/admin/active-jobs" -TimeoutSec 15
    } catch {
        Write-Host "Backend não respondeu ao active-jobs ($($_.Exception.Message)); seguindo com o deploy."
        break
    }
    if ($status.active -eq 0) {
        Write-Host "Nenhum corte em andamento. Publicando..."
        break
    }
    if ((Get-Date) -gt $deadline) {
        throw "Ainda há $($status.active) corte(s) rodando após $MaxWaitMinutes min. Deploy cancelado; tente de novo mais tarde."
    }
    $secs = ($status.jobs | ForEach-Object { $_.running_for_s }) -join ", "
    Write-Host "$($status.active) corte(s) em andamento (rodando há ${secs}s). Aguardando 20s..."
    Start-Sleep -Seconds 20
}

Push-Location $PSScriptRoot
try {
    & $fly deploy --strategy immediate --wait-timeout 10m
    if ($LASTEXITCODE -ne 0) { throw "fly deploy falhou (código $LASTEXITCODE)" }
} finally {
    Pop-Location
}
