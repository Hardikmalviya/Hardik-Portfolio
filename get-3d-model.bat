@echo off
echo Downloading the Apple iPhone Duo 3D model (about 10-20 MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://www.apple.com/105/media/us/iphone-duo/2026/9305e4b9-72d9-4c05-9381-b572adadd5e5/ar/iPhone_Duo_e-sim_Star-White_Variant.usdz' -OutFile '%~dp0iPhone_Duo.usdz'; Write-Host 'Download finished:' (Get-Item '%~dp0iPhone_Duo.usdz').Length 'bytes' } catch { Write-Host 'Download failed:' $_.Exception.Message }"
echo.
echo Done. You can close this window and tell Claude it's done.
pause
