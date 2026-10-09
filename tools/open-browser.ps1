# Poll the local game address so we do not show a connection error before startup.
param([ValidateRange(1, 65535)][int]$Port = 8177)
$ErrorActionPreference = 'SilentlyContinue'
$url = 'http://127.0.0.1:{0}/' -f $Port
for ($i = 0; $i -lt 60; $i++) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $pending = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
        if ($pending.AsyncWaitHandle.WaitOne(400)) {
            $tcp.EndConnect($pending)
            $tcp.Close()
            Start-Process $url
            exit 0
        }
        $tcp.Close()
    } catch { }
    Start-Sleep -Milliseconds 250
}
