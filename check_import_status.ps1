# PowerShell script to check import status and retry if needed

Write-Host "=== Checking Solution Import Status ===" -ForegroundColor Cyan

# Check current solution version in TEST
Write-Host "`nChecking current solution version in TEST environment..."
$currentVersion = pac solution list | Select-String "BusinessImprovementHub"
Write-Host "Current: $currentVersion"

# Expected version
Write-Host "Expected version: 1.2.2.41" -ForegroundColor Yellow

# Check if import is still running
Write-Host "`nAttempting to check if import is still running..."
$retryImport = $false

try {
    # Try a dummy import to see if we get the "already running" error
    $testImport = pac solution import --path "./dummy.zip" 2>&1
    if ($testImport -match "Cannot start another") {
        Write-Host "Import is STILL RUNNING. Please wait..." -ForegroundColor Yellow
        Write-Host "Check status at: https://admin.powerplatform.microsoft.com" -ForegroundColor Cyan
        Write-Host "Go to Environments > Full Asset Potential Test > Settings > History > Solution History" -ForegroundColor Cyan
    } else {
        $retryImport = $true
    }
} catch {
    $retryImport = $true
}

if ($currentVersion -match "1.2.2.41") {
    Write-Host "`nSUCCESS! Solution has been updated to version 1.2.2.41" -ForegroundColor Green
    Write-Host "The import completed successfully!" -ForegroundColor Green
} elseif ($currentVersion -match "1.2.2.26") {
    Write-Host "`nSolution is still at old version 1.2.2.26" -ForegroundColor Yellow

    if ($retryImport) {
        Write-Host "`nNo import is currently running. Retrying import with different approach..." -ForegroundColor Cyan

        Write-Host "`n=== MANUAL FIX INSTRUCTIONS ===" -ForegroundColor Yellow
        Write-Host @"

The CustomControl dependency is blocking the import even with --skip-dependency-check.

OPTION 1: Delete the problematic control directly in TEST
---------------------------------------------------------
1. Go to https://make.powerapps.com
2. Select TEST environment
3. Go to Solutions > Default Solution
4. Navigate to Custom controls
5. Search for any control with these patterns:
   - Name contains "MyTaskWidget"
   - GUID contains "ff2cff1b"
   - Any control showing errors
6. Delete the control if found

OPTION 2: Use XrmToolBox to force delete
-----------------------------------------
1. Download XrmToolBox
2. Connect to TEST environment
3. Use "Bulk Deletion Manager" to find and delete the control

OPTION 3: Reset the environment (LAST RESORT)
----------------------------------------------
1. Export any critical data from TEST
2. Reset the TEST environment
3. Re-import all solutions

OPTION 4: Try unmanaged import
-------------------------------
Run this command to import as unmanaged (may allow override):
pac solution import --path "./BusinessImprovementHub_latest.zip" --managed false --force-overwrite

"@ -ForegroundColor Cyan
    }
}

Write-Host "`n=== Check Again ===" -ForegroundColor Green
Write-Host "To check status again, run: .\check_import_status.ps1"