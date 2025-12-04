@echo off
echo Building FUNLHN Medicine Tracker...
echo.

REM Build React frontend
echo [1/3] Building frontend...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo [2/3] Installing Python dependencies...
pip install -r requirements.txt --quiet

echo.
echo [3/3] Building executable...
REM Note: This creates a FOLDER named 'dist\FUNLHN_Medicine_Tracker'
py -m PyInstaller --noconfirm --onedir --windowed --icon="app.ico" --splash "splash.png" --add-data "frontend/build;build" --add-data "seed_data.json;." --name "FUNLHN_Medicine_Tracker" --version-file="version_info.txt" server.py

echo.
echo [4/4] Signing executable...
powershell -ExecutionPolicy Bypass -File sign_app.ps1

echo.
echo ========================================================
echo                 BUILD COMPLETE
echo ========================================================
echo.
echo CRITICAL DEPLOYMENT INSTRUCTIONS:
echo.
echo 1. Go to the 'dist' folder.
echo 2. You will see a FOLDER named 'FUNLHN_Medicine_Tracker'.
echo 3. Copy that ENTIRE FOLDER to your network drive inside '_system_data'.
echo    (Do NOT just copy the .exe file!)
echo.
echo 4. Create a shortcut to the .exe inside that folder.
echo.
pause