@echo off
setlocal
cd /d "%~dp0"
echo.
echo === FoodRescue setup for Windows ===
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.11, 3.12 or 3.13 from https://www.python.org/downloads/
  echo and tick "Add python.exe to PATH" during installation. Then run this file again.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 LTS from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)

echo [1/4] Creating Python virtual environment in apps\api\.venv ...
if not exist "apps\api\.venv\Scripts\python.exe" python -m venv apps\api\.venv
if errorlevel 1 goto :fail

echo [2/4] Installing Python packages from the bundled wheels (no internet needed) ...
"apps\api\.venv\Scripts\python.exe" -m pip install --no-index --find-links vendor\python-wheels -r apps\api\requirements.txt
if errorlevel 1 (
  echo Offline install failed, retrying from the internet ...
  "apps\api\.venv\Scripts\python.exe" -m pip install -r apps\api\requirements.txt
  if errorlevel 1 goto :fail
)

echo [3/4] Writing local configuration (SQLite database, no Docker needed) ...
pushd apps\api
".venv\Scripts\python.exe" -m app.scripts.write_local_env
if errorlevel 1 (popd & goto :fail)
popd

echo [4/4] Creating database tables ...
pushd apps\api
".venv\Scripts\python.exe" -m app.scripts.init_local_db
if errorlevel 1 (popd & goto :fail)
echo.
echo Create your administrator account (public sign-up can't create admins).
set /p ADMIN_EMAIL=Admin email address: 
".venv\Scripts\python.exe" -m app.scripts.create_admin --email %ADMIN_EMAIL% --name "Platform Administrator"
popd

echo.
echo Setup complete. Now double-click start-foodrescue.bat
pause
exit /b 0

:fail
echo.
echo Setup failed. Scroll up to see the error.
pause
exit /b 1
