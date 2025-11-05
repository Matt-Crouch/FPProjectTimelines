# PowerShell script to fix the deployment blocking issue
# This removes the problematic MyTaskWidget control reference

Write-Host "=== Deployment Fix Script ===" -ForegroundColor Cyan
Write-Host "This script will help remove the blocking reference to CustomControl ff2cff1b-9940-4d09-b57f-f5fb2e47aad6" -ForegroundColor Yellow

# Step 1: Check current environment
Write-Host "`nStep 1: Checking environment..." -ForegroundColor Green
$currentEnv = pac org who
Write-Host $currentEnv

if ($currentEnv -notmatch "test" -and $currentEnv -notmatch "Test") {
    Write-Host "`nWARNING: You should be connected to TEST environment to fix this issue" -ForegroundColor Red
    Write-Host "To connect to TEST: pac auth create --environment [TEST_URL]" -ForegroundColor Yellow
}

# Step 2: Create a temporary solution to capture the problematic component
Write-Host "`nStep 2: Creating temporary cleanup solution..." -ForegroundColor Green

$solutionName = "TempCleanup_" + (Get-Date -Format "yyyyMMddHHmmss")
$publisherPrefix = "temp"

Write-Host "Creating solution: $solutionName"

# Create the cleanup solution
pac solution create --name $solutionName --publisher-name TempPublisher --publisher-prefix $publisherPrefix

# Step 3: Try to identify what's using the control
Write-Host "`nStep 3: Searching for components using the control..." -ForegroundColor Green

# List all canvas apps that might use the control
Write-Host "`nChecking Canvas Apps..."
pac canvas list

# Step 4: Manual cleanup steps
Write-Host "`n=== MANUAL CLEANUP STEPS ===" -ForegroundColor Yellow
Write-Host @"

Since the MyTaskWidget control is being referenced, check these locations in your TEST environment:

1. CANVAS APPS:
   - Open Power Apps Studio (make.powerapps.com)
   - Switch to TEST environment
   - Open each Canvas app
   - Go to Insert > Custom > Import component
   - Check if MyTaskWidget is listed
   - If found, remove it from the app

2. MODEL-DRIVEN APP FORMS:
   - Go to Tables in maker portal
   - For each table with forms:
     * Open form editor
     * Check each field's properties
     * Look for "Control" tab
     * Remove any custom control configurations for MyTaskWidget

3. SITE MAP / APP MODULE:
   - Open your Model-driven app
   - Check if any dashboard or custom page references the control
   - Remove any custom control references

4. BUSINESS PROCESS FLOWS:
   - Check if any BPF uses custom controls
   - Remove custom control configurations

"@ -ForegroundColor Cyan

# Step 5: Force removal approach
Write-Host "`n=== FORCE REMOVAL APPROACH ===" -ForegroundColor Red
Write-Host @"

If you can't find the reference, try these approaches:

APPROACH 1: Override Import
--------------------------
pac solution import --path "BusinessImprovementHub.zip" --force-overwrite --skip-dependency-check

APPROACH 2: Clean Import with Upgrade
------------------------------------
pac solution import --path "BusinessImprovementHub.zip" --import-as-holding --force-overwrite

APPROACH 3: Delete and Recreate
-------------------------------
1. Delete the BusinessImprovementHub solution from TEST (if possible)
2. Import fresh: pac solution import --path "BusinessImprovementHub.zip"

APPROACH 4: Component Cleanup
-----------------------------
1. In TEST environment, go to Advanced Settings > Settings > Customizations
2. Click "Customize the System"
3. Go to Components > Custom Controls
4. Find any control with GUID ff2cff1b-9940-4d09-b57f-f5fb2e47aad6
5. Check its dependencies
6. Remove all dependencies manually

"@ -ForegroundColor Yellow

# Step 6: Create a SQL query to find dependencies (if you have access)
Write-Host "`n=== SQL QUERY (If you have database access) ===" -ForegroundColor Magenta
Write-Host @"

SELECT
    d.DependentComponentNodeId,
    d.DependentComponentType,
    d.RequiredComponentNodeId,
    d.RequiredComponentType,
    c.Name as ComponentName
FROM DependencyNode d
LEFT JOIN CustomControlDefaultConfig c
    ON d.DependentComponentNodeId = c.CustomControlDefaultConfigId
WHERE d.RequiredComponentNodeId = 'ff2cff1b-9940-4d09-b57f-f5fb2e47aad6'

"@ -ForegroundColor Gray

Write-Host "`n=== RECOMMENDED NEXT STEPS ===" -ForegroundColor Green
Write-Host @"

1. First, try the force import:
   pac solution import --path "BusinessImprovementHub.zip" --force-overwrite --skip-dependency-check

2. If that fails, manually check Canvas Apps and Forms in TEST environment

3. As a last resort, consider resetting TEST environment (after backing up data)

"@ -ForegroundColor Cyan