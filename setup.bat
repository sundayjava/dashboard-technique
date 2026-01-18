@echo off
setlocal enabledelayedexpansion

echo ================================================================
echo          Acredis Finance - Project Setup Script
echo ================================================================
echo.

REM Check if .env file exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo.
    echo Please create a .env file with the following variables:
    echo.
    echo DATABASE_URL=your_postgresql_connection_string
    echo NEXTAUTH_SECRET=your_secret_key
    echo NEXTAUTH_URL=http://localhost:3000
    echo.
    exit /b 1
)

echo [Step 1] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [SUCCESS] Dependencies installed successfully
echo.

echo [Step 2] Setting up database schema...
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Failed to push database schema
    exit /b 1
)
echo [SUCCESS] Database schema synchronized
echo.

echo [Step 3] Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate Prisma Client
    exit /b 1
)
echo [SUCCESS] Prisma Client generated
echo.

echo [Step 4] Seeding banks...
call npx ts-node prisma/seed-banks.ts
if %errorlevel% neq 0 (
    echo [WARNING] Failed to seed banks (you can do this manually later)
) else (
    echo [SUCCESS] Banks seeded successfully
)
echo.

echo ================================================================
echo              Setup Completed Successfully!
echo ================================================================
echo.
echo Next steps:
echo   1. Run "npm run dev" to start the development server
echo   2. Open http://localhost:3000 in your browser
echo.
echo Additional commands:
echo   - View database: npx prisma studio
echo   - Re-seed banks: npx ts-node prisma/seed-banks.ts
echo   - Build for production: npm run build
echo.
pause
