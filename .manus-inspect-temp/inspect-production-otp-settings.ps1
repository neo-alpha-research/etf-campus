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

$config = Invoke-RestMethod -Method Get -Uri 'https://api.supabase.com/v1/projects/uetzvsfqnydzdvnpytus/config/auth' -Headers @{ Authorization = "Bearer $token" }
$names = @('mailer_otp_exp', 'mailer_otp_length', 'mailer_autoconfirm', 'external_email_enabled', 'disable_signup', 'enable_confirmations')
foreach ($name in $names) {
  if ($null -ne $config.PSObject.Properties[$name]) {
    Write-Output ("{0}={1}" -f $name, $config.$name)
  }
}
