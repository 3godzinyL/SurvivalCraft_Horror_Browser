<#
NightCraft zero-dependency Windows fallback server for PowerShell 5.1+.
Uses TcpListener bound ONLY to 127.0.0.1, so HTTP.sys URLACL and admin
privileges are unnecessary. Intended for local play when Node.js is absent.
#>
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8177
)

$ErrorActionPreference = 'Stop'
$rootDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logsDirectory = Join-Path $rootDirectory 'logs'
$logFile = Join-Path $logsDirectory 'server.log'
try { [System.IO.Directory]::CreateDirectory($logsDirectory) | Out-Null } catch { }

function Write-ServerLog([string]$Message) {
    $line = ('[{0}] {1}' -f ([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')), $Message)
    Write-Host $line
    try { [System.IO.File]::AppendAllText($logFile, ($line + [Environment]::NewLine), [System.Text.Encoding]::UTF8) } catch { }
}

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.glsl' = 'text/plain; charset=utf-8'
    '.wasm' = 'application/wasm'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.wav'  = 'audio/wav'
    '.mp3'  = 'audio/mpeg'
    '.ogg'  = 'audio/ogg'
    '.svg'  = 'image/svg+xml'
    '.txt'  = 'text/plain; charset=utf-8'
}

function Send-HttpHeader(
    [System.IO.Stream]$Stream,
    [int]$Status,
    [string]$Reason,
    [string]$ContentType,
    [long]$Length,
    [string]$Extra = ''
) {
    $headers = 'HTTP/1.1 {0} {1}' -f $Status, $Reason
    $headers += "`r`nContent-Type: $ContentType"
    $headers += "`r`nContent-Length: $Length"
    $headers += "`r`nCache-Control: no-store"
    $headers += "`r`nX-Content-Type-Options: nosniff"
    $headers += "`r`nAccept-Ranges: bytes"
    $headers += "`r`nConnection: close"
    if ($Extra.Length -gt 0) { $headers += "`r`n$Extra" }
    $headers += "`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($bytes, 0, $bytes.Length)
}

function Send-HttpError([System.IO.Stream]$Stream, [int]$Status, [string]$Reason, [bool]$Head = $false) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes("$Status $Reason`n")
    Send-HttpHeader $Stream $Status $Reason 'text/plain; charset=utf-8' $bytes.Length
    if (-not $Head) { $Stream.Write($bytes, 0, $bytes.Length) }
}

function Serve-Client([System.Net.Sockets.TcpClient]$Client) {
    $Client.NoDelay = $true
    $Client.ReceiveTimeout = 5000
    $Client.SendTimeout = 30000
    $stream = $Client.GetStream()
    # Leave the socket stream open: the client will be disposed by the caller.
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
    try {
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { return }
        $parts = $requestLine.Split(' ')
        if ($parts.Length -lt 3) { Send-HttpError $stream 400 'Bad Request'; return }
        $method = $parts[0].ToUpperInvariant()
        $target = $parts[1]
        $headRequest = $method -eq 'HEAD'
        if ($method -ne 'GET' -and $method -ne 'HEAD') {
            Send-HttpError $stream 405 'Method Not Allowed'
            return
        }
        # Read and discard headers. This server is intentionally read-only.
        $rangeHeader = $null
        for ($i = 0; $i -lt 128; $i++) {
            $line = $reader.ReadLine()
            if ($null -eq $line -or $line.Length -eq 0) { break }
            if ($line.StartsWith('Range:', [System.StringComparison]::OrdinalIgnoreCase)) {
                $rangeHeader = $line.Substring(6).Trim()
            }
        }
        $requestPath = $target.Split('?')[0].Split('#')[0]
        $decoded = [System.Uri]::UnescapeDataString($requestPath)
        if ($decoded -eq '/') { $decoded = '/index.html' }
        # Normalize slash and block path escapes, including percent-encoded .. and backslash.
        $localPart = $decoded.Replace('\', '/').TrimStart([char]'/')
        $localPart = $localPart.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $rootDirectory $localPart))
        $rootPrefix = $rootDirectory.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
        if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-HttpError $stream 403 'Forbidden' $headRequest
            return
        }
        if (-not [System.IO.File]::Exists($filePath)) {
            Send-HttpError $stream 404 'Not Found' $headRequest
            return
        }
        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = 'application/octet-stream'
        if ($mimeTypes.ContainsKey($extension)) { $contentType = $mimeTypes[$extension] }
        $fileSize = ([System.IO.FileInfo]::new($filePath)).Length

        # Support byte ranges, which some browsers use when loading game audio.
        $offset = [long]0
        $bodySize = [long]$fileSize
        $status = 200
        $reason = 'OK'
        $extra = ''
        if ($null -ne $rangeHeader -and $rangeHeader -match '^bytes=(\d+)-(\d*)$') {
            $offset = [long]$Matches[1]
            $endOffset = $fileSize - 1
            if ($Matches[2].Length -gt 0) { $endOffset = [Math]::Min($endOffset, [long]$Matches[2]) }
            if ($offset -ge $fileSize -or $endOffset -lt $offset) {
                Send-HttpHeader $stream 416 'Range Not Satisfiable' 'text/plain' 0 ('Content-Range: bytes */{0}' -f $fileSize)
                return
            }
            $bodySize = $endOffset - $offset + 1
            $status = 206
            $reason = 'Partial Content'
            $extra = 'Content-Range: bytes {0}-{1}/{2}' -f $offset, $endOffset, $fileSize
        }
        Send-HttpHeader $stream $status $reason $contentType $bodySize $extra
        if ($headRequest) { return }

        $fileStream = [System.IO.File]::OpenRead($filePath)
        try {
            [void]$fileStream.Seek($offset, [System.IO.SeekOrigin]::Begin)
            $buffer = New-Object byte[] 65536
            $remaining = $bodySize
            while ($remaining -gt 0) {
                $wanted = [int][Math]::Min($remaining, $buffer.Length)
                $count = $fileStream.Read($buffer, 0, $wanted)
                if ($count -le 0) { break }
                $stream.Write($buffer, 0, $count)
                $remaining -= $count
            }
        } finally {
            $fileStream.Dispose()
        }
    } finally {
        $reader.Dispose()
    }
}

$listener = $null
try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $Port)
    $listener.Start(128)
    Write-ServerLog ('NightCraft V15.1 ready: http://127.0.0.1:{0}/ (PowerShell fallback, no admin needed)' -f $Port)
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            Serve-Client $client
        } catch {
            Write-ServerLog ('HTTP request error: ' + $_.Exception.Message)
        } finally {
            $client.Dispose()
        }
    }
} catch {
    Write-ServerLog ('FATAL: ' + $_.Exception.ToString())
    exit 1
} finally {
    if ($null -ne $listener) { $listener.Stop() }
}
