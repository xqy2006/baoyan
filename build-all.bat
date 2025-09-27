@echo off
setlocal
chcp 65001 >nul

REM =====================================
REM  XM U Demo - Build Script (Frontend + Backend)
REM  Usage:
REM    build-all.bat          (normal build)
REM    build-all.bat fast     (skip npm install if node_modules exists)
REM =====================================

set MODE=%1
if "%MODE%"=="" set MODE=normal

set FRONTEND_DIR=frontend
set FRONTEND_BUILD=%FRONTEND_DIR%\build
set STATIC_DIR=src\main\resources\static
set MVNW=mvnw.cmd

echo ======================================
echo  XM U Demo Build (MODE=%MODE%)
echo  %DATE% %TIME%
echo ======================================

REM ---- Step 1: Frontend dependencies (optional) ----
echo.
echo [1/4] Checking frontend dependencies...
if not exist "%FRONTEND_DIR%\package.json" goto no_pkg
if /I not "%MODE%"=="fast" (
  if not exist "%FRONTEND_DIR%\node_modules" (
    echo Installing npm dependencies...
    pushd "%FRONTEND_DIR%"
    call npm install || goto fail
    popd
  ) else (
    echo node_modules exists, skipping install.
  )
) else (
  echo MODE=fast -> skip dependency install.
)

REM ---- Step 2: Frontend build ----
echo.
echo [2/4] Building frontend...
pushd "%FRONTEND_DIR%"
call npm run build || goto fail
popd
if not exist "%FRONTEND_BUILD%\index.html" goto no_build

REM ---- Step 3: Sync static resources ----
echo.
echo [3/4] Copying frontend build to %STATIC_DIR% ...
if exist "%STATIC_DIR%" rmdir /s /q "%STATIC_DIR%"
mkdir "%STATIC_DIR%" || goto fail
xcopy /E /Q /Y /I "%FRONTEND_BUILD%" "%STATIC_DIR%" >nul || goto fail
echo Frontend assets copied.

REM ---- Step 4: Backend build ----
echo.
echo [4/4] Building backend JAR...
call %MVNW% clean package -DskipTests || goto fail

echo.
echo Generated JAR(s):
set FOUND_JAR=
for %%f in (target\xmudemo-*.jar) do (
  echo   %%f
  set FOUND_JAR=1
)
if not defined FOUND_JAR echo WARNING: No JAR produced (pattern target\xmudemo-*.jar)

echo.
echo ===== BUILD SUCCESS =====
exit /b 0

:no_pkg
echo ERROR: %FRONTEND_DIR%\package.json not found.
goto fail

:no_build
echo ERROR: Frontend build output missing: %FRONTEND_BUILD%\index.html
goto fail

:fail
echo.
echo ===== BUILD FAILED =====
exit /b 1
