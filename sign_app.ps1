$certName = "FUNLHN_Medicine_Tracker_Cert"
$certPassword = ConvertTo-SecureString -String "Funlhn123!" -Force -AsPlainText
$certPath = "FUNLHN_Cert.pfx"

# 1. Create Self-Signed Certificate
Write-Host "Creating self-signed certificate..."
$cert = New-SelfSignedCertificate -CertStoreLocation Cert:\CurrentUser\My -Subject "CN=$certName" -KeyExportPolicy Exportable -KeyUsage DigitalSignature -Type CodeSigningCert

# 2. Export to PFX
Write-Host "Exporting certificate to $certPath..."
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certPassword

# 3. Sign the Executable
$exePath = "dist\FUNLHN_Medicine_Tracker\FUNLHN_Medicine_Tracker.exe"
if (Test-Path $exePath) {
    Write-Host "Signing executable..."
    Set-AuthenticodeSignature -FilePath $exePath -Certificate $cert
    Write-Host "Successfully signed $exePath"
} else {
    Write-Host "Executable not found at $exePath. Please build the app first."
}
