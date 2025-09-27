@echo off
setlocal
chcp 65001 >nul

echo ======================================
echo  XM U Demo - Quick Start (Force Rebuild)
echo  %DATE% %TIME%
echo ======================================

set PORT=%1
if "%PORT%"=="" set PORT=8080

echo Building project...
call build-all.bat
if errorlevel 1 (
  echo Build failed. Abort.
  exit /b 1
)

set APP_JAR=
for %%f in (target\xmudemo-*.jar) do set APP_JAR=%%f
if "%APP_JAR%"=="" (
  echo ERROR: JAR not found after build.
  exit /b 1
)
echo Starting: %APP_JAR% on port %PORT%
echo (Press Ctrl + C to stop)
java -jar "%APP_JAR%" --server.port=%PORT%
endlocal

