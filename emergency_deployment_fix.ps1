# Emergency Deployment Fix Script
# Since this has worked dozens of times before, something changed in TEST environment

Write-Host "=== EMERGENCY DEPLOYMENT FIX ===" -ForegroundColor Red
Write-Host "Since you've deployed this dozens of times successfully, something changed in TEST." -ForegroundColor Yellow
Write-Host ""

# Switch to TEST environment
Write-Host "Step 1: Connecting to TEST environment..." -ForegroundColor Cyan
pac auth create --url "https://fullpotentialtest.crm4.dynamics.com/"

Write-Host "`nStep 2: Current solution status..." -ForegroundColor Cyan
pac solution list | Select-String "BusinessImprovementHub"

Write-Host "`n=== QUICK FIXES TO TRY ===" -ForegroundColor Green

Write-Host "`nFIX 1: Try unmanaged import (sometimes bypasses dependency issues)"
Write-Host "pac solution import --path ""BusinessImprovementHub_unmanaged.zip"" --force-overwrite"

Write-Host "`nFIX 2: Delete and reimport (clears cached dependencies)"
Write-Host "pac solution delete --name BusinessImprovementHub"
Write-Host "pac solution import --path ""BusinessImprovementHub_latest.zip"""

Write-Host "`nFIX 3: Import with convert to managed"
Write-Host "pac solution import --path ""BusinessImprovementHub_unmanaged.zip"" --convert-to-managed --force-overwrite"

Write-Host "`n=== INVESTIGATION STEPS ===" -ForegroundColor Yellow
Write-Host @"

Since this worked before, check what changed in TEST environment:

1. RECENT CHANGES CHECK:
   - Who made changes to TEST environment recently?
   - Were any Canvas Apps modified?
   - Were any forms updated?
   - Was another solution imported that might reference MyTaskWidget?

2. CANVAS APPS (Most likely culprit):
   - Go to make.powerapps.com > TEST environment
   - Apps > Canvas apps
   - Open each app and check Insert > Custom > Import Component
   - Look for MyTaskWidget component and remove it

3. FORMS CHECK:
   - Tables > Select tables used in your solution
   - Open forms and check field properties
   - Look for Custom Control configurations on fields

4. SOLUTION COMPONENTS:
   - Default Solution > Custom controls
   - Look for any control with GUID ff2cff1b-9940-4d09-b57f-f5fb2e47aad6
   - Delete if found

"@ -ForegroundColor Cyan

Write-Host "`n=== NUCLEAR OPTION ===" -ForegroundColor Red
Write-Host @"

If all else fails (LAST RESORT):

1. Export critical data from TEST
2. Reset TEST environment
3. Re-import all solutions

This will definitely work but requires rebuilding TEST.

"@ -ForegroundColor Yellow

Write-Host "`n=== AUTOMATED ATTEMPT ===" -ForegroundColor Green
Write-Host "Attempting automated fixes..."

# Try the unmanaged import first
Write-Host "`nTrying unmanaged import..."
$result1 = pac solution import --path "BusinessImprovementHub_unmanaged.zip" --force-overwrite 2>&1

if ($result1 -match "succeeded" -or $result1 -match "completed successfully") {
    Write-Host "SUCCESS: Unmanaged import worked!" -ForegroundColor Green
} else {
    Write-Host "Unmanaged import failed: $result1" -ForegroundColor Red

    Write-Host "`nTrying delete and reimport..."
    pac solution delete --name BusinessImprovementHub --force
    Start-Sleep -Seconds 10
    $result2 = pac solution import --path "BusinessImprovementHub_latest.zip" 2>&1

    if ($result2 -match "succeeded" -or $result2 -match "completed successfully") {
        Write-Host "SUCCESS: Delete and reimport worked!" -ForegroundColor Green
    } else {
        Write-Host "Delete and reimport failed: $result2" -ForegroundColor Red
        Write-Host "`nMANUAL INTERVENTION REQUIRED" -ForegroundColor Red
        Write-Host "Please check the Canvas Apps and Forms in TEST environment manually." -ForegroundColor Yellow
    }
}

Write-Host "`nFinal status check..."
pac solution list | Select-String "BusinessImprovementHub"