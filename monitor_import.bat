@echo off
echo === Solution Import Monitor ===
echo.
echo Checking solution version every 60 seconds...
echo Press Ctrl+C to stop monitoring
echo.

:loop
echo %TIME% - Checking solution version...
pac solution list | findstr /i "BusinessImprovementHub"
echo.

REM Check if version changed to 1.2.2.42
pac solution list | findstr /i "BusinessImprovementHub" | findstr "1.2.2.42" >nul
if %errorlevel% == 0 (
    echo SUCCESS! Solution updated to version 1.2.2.42
    echo Import completed successfully!
    goto end
)

REM Check if version changed to any other number higher than .41
pac solution list | findstr /i "BusinessImprovementHub" | findstr "1.2.2.43 1.2.2.44 1.2.2.45" >nul
if %errorlevel% == 0 (
    echo Solution version updated! Import completed.
    goto end
)

echo Waiting 60 seconds before next check...
timeout /t 60 /nobreak >nul
goto loop

:end
echo.
echo Import monitoring complete.
pause