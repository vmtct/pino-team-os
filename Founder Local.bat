@echo off
setlocal
title PINO Founder Local Launcher

cd /d "%~dp0"
set "TEAM_ROOT=%CD%"
set "CORE_PATH="

echo.
echo ========================================
echo   PINO Founder Local
echo ========================================
echo.

if not exist ".env.local" (
  echo [ERROR] .env.local not found in pino-team-os.
  echo Add PINO_CORE_REPO_PATH first, then run this launcher again.
  pause
  exit /b 1
)

for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"PINO_CORE_REPO_PATH=" ".env.local"') do set "CORE_PATH=%%B"

if not defined CORE_PATH (
  echo [ERROR] PINO_CORE_REPO_PATH is missing from .env.local.
  pause
  exit /b 1
)

if not exist "%CORE_PATH%\docs" (
  echo [ERROR] pino-core was not found at:
  echo %CORE_PATH%
  echo Check PINO_CORE_REPO_PATH in .env.local.
  pause
  exit /b 1
)

echo [1/4] Updating pino-core...
git -C "%CORE_PATH%" pull --ff-only
if errorlevel 1 (
  echo.
  echo [ERROR] Could not update pino-core. No files were changed by this launcher.
  pause
  exit /b 1
)

echo.
echo [2/4] Updating pino-team-os...
git -C "%TEAM_ROOT%" pull --ff-only
if errorlevel 1 (
  echo.
  echo [ERROR] Could not update pino-team-os. Resolve the Git state, then try again.
  pause
  exit /b 1
)

echo.
echo [3/4] Checking dependencies...
call npm install --prefer-offline --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [4/4] Starting Team OS...
start "PINO Team OS Dev" cmd /k "npm run dev"

echo Waiting for http://127.0.0.1:3000 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:3000/founder/docs'; $ready=$false; for($i=0;$i -lt 45;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){$ready=$true; break} } catch {}; Start-Sleep -Seconds 1 }; if($ready){Start-Process $url; exit 0}else{exit 1}"

if errorlevel 1 (
  echo.
  echo [WARN] Team OS did not answer on port 3000 yet.
  echo Check the "PINO Team OS Dev" window for the exact error.
  echo Then open: http://127.0.0.1:3000/founder/docs
  pause
  exit /b 1
)

echo.
echo Founder Docs opened in your browser.
echo Keep the "PINO Team OS Dev" window open while using local Team OS.
timeout /t 3 /nobreak >nul
endlocal
