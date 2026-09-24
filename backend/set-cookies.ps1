# Cadastra no Fly os cookies de login de uma rede social (para listar perfis inteiros).
#
# 1. No Chrome, logado na conta, instale a extensão "Get cookies.txt LOCALLY".
# 2. Abra instagram.com (ou facebook.com / tiktok.com) e exporte o cookies.txt.
# 3. Rode:  powershell -ExecutionPolicy Bypass -File backend\set-cookies.ps1 -Platform instagram -File C:\caminho\cookies.txt
#
# O conteúdo vai direto para o secret do Fly, sem aparecer na tela. O Fly reinicia o
# backend para carregar o secret; use com o servidor ocioso (veja backend\deploy.ps1).
param(
    [Parameter(Mandatory = $true)][ValidateSet("instagram", "facebook", "tiktok", "youtube")][string]$Platform,
    [Parameter(Mandatory = $true)][string]$File
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $File)) { throw "Arquivo não encontrado: $File" }
$fly = (Get-Command flyctl -ErrorAction SilentlyContinue).Source
if (-not $fly) { $fly = (Get-Command fly -ErrorAction SilentlyContinue).Source }
if (-not $fly) { $fly = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe" }

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $File)))
$name = "$($Platform.ToUpper())_COOKIES_B64"
& $fly secrets set "$name=$b64" -a clippost-backend | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Falha ao salvar o secret $name no Fly." }
Write-Host "Cookies do $Platform salvos em $name. Confira em https://clippost-backend.fly.dev/api/admin/cookies-status"
