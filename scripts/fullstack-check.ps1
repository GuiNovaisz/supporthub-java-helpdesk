#Requires -Version 7.0
[CmdletBinding()]
param([string]$GalleryDirectory)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$project = 'supporthub-e2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$env:DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:ADMIN_EMAIL = 'admin@example.test'
$env:ADMIN_PASSWORD = [guid]::NewGuid().ToString('N')
$env:WEB_PORT = '0'
$env:SESSION_COOKIE_SECURE = 'false'
if ($GalleryDirectory) {
    $env:SUPPORTHUB_GALLERY = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($GalleryDirectory)
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
    docker compose -p $project config --quiet
    docker compose -p $project up --build --wait --wait-timeout 180
    docker compose -p $project ps
    docker compose -p $project exec -T web id
    docker compose -p $project logs api | Select-String 'Successfully applied|PostgreSQL 17'
    $binding = docker compose -p $project port web 8080
    $env:SUPPORTHUB_BASE_URL = "http://$binding"
    & "$PSScriptRoot/smoke.ps1" -BaseUri $env:SUPPORTHUB_BASE_URL
    npm.cmd --prefix frontend run e2e
} catch {
    docker compose -p $project logs --tail=60
    throw
} finally {
    docker compose -p $project down --volumes
    Pop-Location
}
