@echo off
cd /d "%~dp0"
if not exist "apps\api\.venv\Scripts\python.exe" (
  echo Run setup-windows.bat first.
  pause
  exit /b 1
)
echo Starting the API on http://127.0.0.1:8000 ...
start "FoodRescue API" cmd /k "cd /d apps\api && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
echo Starting the web app on http://localhost:3000 ...
start "FoodRescue Web" cmd /k "cd /d apps\web && npm run dev"
timeout /t 8 >nul
start "" http://localhost:3000
echo.
echo Two windows opened: "FoodRescue API" and "FoodRescue Web". Close them to stop the app.
echo Emails (verification and password-reset links) appear in the "FoodRescue API" window.
