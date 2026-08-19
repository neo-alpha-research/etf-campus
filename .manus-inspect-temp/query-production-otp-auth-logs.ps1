$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credentialPtr);
  [DllImport("Advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr credentialPtr);
  public static string ReadGeneric(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) return null;
    try {
      var credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      var bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return Encoding.UTF8.GetString(bytes).Trim('\0', '\r', '\n', ' ');
    } finally { CredFree(pointer); }
  }
}
'@

$token = $env:SUPABASE_ACCESS_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  $tokenPath = Join-Path $env:USERPROFILE '.supabase\access-token'
  if (Test-Path $tokenPath) { $token = (Get-Content -Raw $tokenPath).Trim() }
}
if ([string]::IsNullOrWhiteSpace($token)) { $token = [CredentialReader]::ReadGeneric('Supabase CLI:supabase') }
if ([string]::IsNullOrWhiteSpace($token)) { throw 'Supabase management token is unavailable.' }

$sql = @'
select timestamp,
       JSONExtractString(event_message, 'msg') as message,
       JSONExtractString(event_message, 'error') as error,
       JSONExtractString(event_message, 'err') as err,
       JSONExtractString(event_message, 'path') as path,
       JSONExtractString(event_message, 'status') as status
from logs
where source = 'auth_logs'
  and timestamp >= now() - INTERVAL 60 MINUTE
  and JSONExtractString(event_message, 'path') in ('/otp', '/verify')
order by timestamp desc
limit 30
'@.Trim()

$start = (Get-Date).ToUniversalTime().AddMinutes(-60).ToString('yyyy-MM-ddTHH:mm:ssZ')
$end = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$uri = 'https://api.supabase.com/v1/projects/uetzvsfqnydzdvnpytus/analytics/endpoints/logs?sql=' + [uri]::EscapeDataString($sql) + '&iso_timestamp_start=' + [uri]::EscapeDataString($start) + '&iso_timestamp_end=' + [uri]::EscapeDataString($end)
$response = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $token" }
$json = $response | ConvertTo-Json -Depth 10 -Compress
$json = [regex]::Replace($json, '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', '[redacted-email]')
$json = [regex]::Replace($json, '\b(?:\d{1,3}\.){3}\d{1,3}\b', '[redacted-ip]')
$json = [regex]::Replace($json, '(?<![.:])\\b\\d{6,8}\\b', '[redacted-code]')
Write-Output $json
