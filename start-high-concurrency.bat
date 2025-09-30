@echo off
REM High Concurrency Version Quick Start Script
REM Start Redis, RabbitMQ, MySQL and Application

echo ================================================
echo XMU Demo High Concurrency Version Startup
echo ================================================

echo [1/4] Checking Docker environment...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker not installed or not running! Please install and start Docker first
    pause
    exit /b 1
)

echo [2/4] Building and starting all services...
docker-compose up -d --build

echo [3/4] Waiting for services to start...
timeout /t 30 /nobreak >nul

echo [4/4] Checking service status...
docker-compose ps

echo.
echo ================================================
echo Service URLs:
echo - Frontend and Backend: http://localhost:8080
echo - RabbitMQ Management: http://localhost:15672 (admin/admin123)
echo - Health Check: http://localhost:8080/actuator/health
echo - Demo APIs: http://localhost:8080/api/demo/
echo ================================================
echo.
echo Services started successfully! Press any key to view logs...
pause >nul

docker-compose logs -f backend
