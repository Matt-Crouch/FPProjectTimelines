@echo off
echo === Force Import Solution to TEST Environment ===
echo.

REM Step 1: Connect to TEST environment
echo Step 1: Connecting to TEST environment...
echo Please complete the browser authentication when prompted
pac auth create --url "https://fullpotentialtest.crm4.dynamics.com/"

REM Verify connection
echo.
echo Verifying connection...
pac org who

REM Step 2: Force import the solution
echo.
echo Step 2: Starting force import with skip dependency check...
echo This will bypass the CustomControl dependency error
pac solution import --path "BusinessImprovementHub_latest.zip" --force-overwrite --skip-dependency-check

echo.
echo ========================================
echo Import command has been executed!
echo.
echo If the import still fails, try these alternative commands:
echo.
echo Alternative 1 - Import as holding:
echo pac solution import --path "BusinessImprovementHub_latest.zip" --import-as-holding --force-overwrite
echo.
echo Alternative 2 - Async import:
echo pac solution import --path "BusinessImprovementHub_latest.zip" --async --force-overwrite
echo.
echo ========================================
pause