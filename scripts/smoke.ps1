#Requires -Version 7.0
[CmdletBinding()]
param(
    [uri]$BaseUri = 'http://127.0.0.1:8080',
    [string]$AdminEmail = $env:ADMIN_EMAIL,
    [string]$AdminPassword = $env:ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
if (!$AdminEmail -or !$AdminPassword) { throw 'Set ADMIN_EMAIL and ADMIN_PASSWORD for the test administrator.' }

function New-SmokeSession {
    return @{ Cookies = [Microsoft.PowerShell.Commands.WebRequestSession]::new(); Headers = @{} }
}

function Invoke-SmokeRequest($Session, [string]$Method, [string]$Path, [int]$Expected, $Payload) {
    $options = @{
        Uri = [uri]::new($BaseUri, $Path)
        Method = $Method
        WebSession = $Session.Cookies
        Headers = $Session.Headers
        SkipHttpErrorCheck = $true
        TimeoutSec = 20
    }
    if ($null -ne $Payload) {
        $options.ContentType = 'application/json'
        $options.Body = ConvertTo-Json -InputObject $Payload -Compress
    }
    $result = Invoke-WebRequest @options
    if ($result.StatusCode -ne $Expected) {
        throw "$Method $Path returned $($result.StatusCode), expected $Expected."
    }
    $content = $result.Content
    if ($content -is [byte[]]) {
        $content = [Text.Encoding]::UTF8.GetString($content)
    }
    if ($content -and $result.BaseResponse.Content.Headers.ContentType.MediaType -match '[/+]json$') {
        return ConvertFrom-Json -InputObject $content
    }
    return $content
}

function Update-SmokeCsrf($Session) {
    $csrf = Invoke-SmokeRequest $Session GET '/api/v1/auth/csrf' 200
    if (!$csrf.token) { throw 'Missing CSRF token.' }
    $Session.Headers[$csrf.headerName] = $csrf.token
}

function Connect-SmokeSession($Session, [string]$Email, [string]$Password) {
    Update-SmokeCsrf $Session
    Invoke-SmokeRequest $Session POST '/api/v1/auth/login' 204 @{
        email = $Email
        password = $Password
    } | Out-Null
    Update-SmokeCsrf $Session
}

function New-SmokeCredentials([string]$Name) {
    return @{
        name = $Name
        email = "$([guid]::NewGuid().ToString('N'))@example.test"
        password = [guid]::NewGuid().ToString('N')
    }
}

$admin = New-SmokeSession
$agent = New-SmokeSession
$alice = New-SmokeSession
$bob = New-SmokeSession

$health = Invoke-SmokeRequest $admin GET '/actuator/health/readiness' 200
if ($health.status -ne 'UP') { throw 'Application readiness is not UP.' }
$api = Invoke-SmokeRequest $admin GET '/v3/api-docs' 200
if ($api.info.title -ne 'SupportHub API') { throw 'Unexpected OpenAPI document.' }
$swagger = Invoke-SmokeRequest $admin GET '/swagger-ui/index.html' 200
if ($swagger -notlike '*Swagger UI*') { throw 'Swagger UI was not served.' }

Connect-SmokeSession $admin $AdminEmail $AdminPassword
$adminAccount = Invoke-SmokeRequest $admin GET '/api/v1/auth/me' 200
if ($adminAccount.role -ne 'ADMIN') { throw 'Bootstrap account is not an administrator.' }
$agentCredentials = New-SmokeCredentials 'Smoke Agent'
$agentAccount = Invoke-SmokeRequest $admin POST '/api/v1/admin/users/agents' 201 $agentCredentials
Connect-SmokeSession $agent $agentCredentials.email $agentCredentials.password

foreach ($customer in @(@{ Session = $alice; Name = 'Alice' }, @{ Session = $bob; Name = 'Bob' })) {
    $credentials = New-SmokeCredentials $customer.Name
    Update-SmokeCsrf $customer.Session
    Invoke-SmokeRequest $customer.Session POST '/api/v1/auth/register' 201 $credentials | Out-Null
    Connect-SmokeSession $customer.Session $credentials.email $credentials.password
}

$ticket = Invoke-SmokeRequest $alice POST '/api/v1/tickets' 201 @{
    title = 'Smoke flow'
    description = 'Fresh Compose stack validation'
}
$customerPath = "/api/v1/tickets/$($ticket.reference)"
$staffPath = "/api/v1/agent/tickets/$($ticket.reference)"
$claimed = Invoke-SmokeRequest $agent POST "$staffPath/claim" 200
if ($claimed.assignedAgentId -ne $agentAccount.id) { throw 'Unexpected assignee.' }

Invoke-SmokeRequest $agent POST "$staffPath/comments" 201 @{ body = 'First response'; visibility = 'PUBLIC' } | Out-Null
Invoke-SmokeRequest $agent POST "$staffPath/comments" 201 @{ body = 'Internal investigation'; visibility = 'INTERNAL' } | Out-Null
foreach ($status in 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED') {
    $updated = Invoke-SmokeRequest $agent PATCH "$staffPath/status" 200 @{ status = $status }
    if ($updated.status -ne $status) { throw "Expected ticket status $status." }
}
if ($updated.sla.firstResponseStatus -ne 'MET' -or $updated.sla.resolutionStatus -ne 'MET') {
    throw 'Expected both SLA objectives to be met.'
}
$history = Invoke-SmokeRequest $agent GET "$staffPath/history" 200
foreach ($event in 'CREATED', 'SLA_CONFIGURED', 'ASSIGNED', 'FIRST_RESPONSE', 'INTERNAL_COMMENT', 'RESOLVED') {
    if ($event -notin $history.items.type) { throw "Missing history event $event." }
}
$public = Invoke-SmokeRequest $alice GET "$customerPath/comments" 200
if ($public.totalElements -ne 1 -or $public.items[0].visibility -ne 'PUBLIC') { throw 'Incorrect comment visibility.' }
Invoke-SmokeRequest $bob GET $customerPath 404 | Out-Null
Invoke-SmokeRequest $bob POST "$customerPath/comments" 404 @{ body = 'Blocked'; visibility = 'PUBLIC' } | Out-Null
Invoke-SmokeRequest $bob POST "$customerPath/reopen" 404 | Out-Null

foreach ($session in $admin, $agent, $alice, $bob) {
    Invoke-SmokeRequest $session POST '/api/v1/auth/logout' 204 | Out-Null
    Invoke-SmokeRequest $session GET '/api/v1/auth/me' 401 | Out-Null
}
Write-Output "Smoke passed for $($ticket.reference). Health UP, OpenAPI and Swagger available, SLA met, history persisted, ownership and logout enforced."
