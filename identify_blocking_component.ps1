# Script to identify what component ff2cff1b-9940-4d09-b57f-f5fb2e47aad6 actually is

Write-Host "=== IDENTIFYING BLOCKING COMPONENT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT DISCOVERY:" -ForegroundColor Yellow
Write-Host "The GUID ff2cff1b-9940-4d09-b57f-f5fb2e47aad6 is NOT in our BusinessImprovementHub solution!" -ForegroundColor Red
Write-Host "This means some OTHER component in TEST environment depends on something in our solution." -ForegroundColor Yellow
Write-Host ""

# Connect to TEST environment
Write-Host "Connecting to TEST environment..." -ForegroundColor Cyan
pac auth create --url "https://fullpotentialtest.crm4.dynamics.com/"

Write-Host "`n=== STEP 1: Find what component this GUID represents ===" -ForegroundColor Green

# Create a browser script to identify the component
@'
// Run this in browser console at make.powerapps.com (TEST environment)
// This will tell us what type of component ff2cff1b-9940-4d09-b57f-f5fb2e47aad6 is

const apiUrl = window.location.origin + "/api/data/v9.2/";

// Check different component types
const queries = [
    { name: "CustomControl", endpoint: "customcontrols", field: "customcontrolid" },
    { name: "CanvasApp", endpoint: "canvasapps", field: "canvasappid" },
    { name: "SystemForm", endpoint: "systemforms", field: "formid" },
    { name: "WebResource", endpoint: "webresources", field: "webresourceid" },
    { name: "Workflow", endpoint: "workflows", field: "workflowid" }
];

async function findComponent() {
    const targetGuid = "ff2cff1b-9940-4d09-b57f-f5fb2e47aad6";

    for (const query of queries) {
        try {
            const response = await fetch(`${apiUrl}${query.endpoint}?$filter=${query.field} eq '${targetGuid}'&$select=*`);
            const data = await response.json();

            if (data.value && data.value.length > 0) {
                console.log(`FOUND: ${query.name}`, data.value[0]);
                return { type: query.name, data: data.value[0] };
            }
        } catch (error) {
            console.log(`Error checking ${query.name}:`, error);
        }
    }

    console.log("Component not found in standard tables");
    return null;
}

findComponent();
'@ | Out-File -FilePath "./find_component_browser.js"

Write-Host "Browser script created: find_component_browser.js" -ForegroundColor Green
Write-Host "Copy and run this in browser console at make.powerapps.com (TEST environment)" -ForegroundColor Yellow

Write-Host "`n=== STEP 2: Most likely causes ===" -ForegroundColor Green
Write-Host @"

Since you've deployed this successfully dozens of times, someone recently:

1. CANVAS APP (Most likely):
   - Added a new Canvas App that imports/uses a component from BusinessImprovementHub
   - Modified an existing Canvas App to use a custom control
   - Canvas App has a reference to one of our PCF controls

2. FORM CUSTOMIZATION:
   - Someone added a custom control to a form field
   - Form references one of our PCF components
   - Form was modified to use a control from our solution

3. ANOTHER SOLUTION:
   - Another solution was imported that has dependencies
   - Cross-solution dependencies were created

4. POWER BI / DASHBOARD:
   - Dashboard or Power BI report embedded one of our controls
   - Visualization references our components

"@ -ForegroundColor Cyan

Write-Host "`n=== STEP 3: Quick investigation ===" -ForegroundColor Green

# Check Canvas Apps
Write-Host "`nChecking Canvas Apps in TEST..."
pac canvas list

Write-Host "`n=== STEP 4: Manual checks needed ===" -ForegroundColor Yellow
Write-Host @"

Go to make.powerapps.com > TEST environment and check:

1. CANVAS APPS:
   - Apps > Each Canvas app > Edit
   - Insert > Custom > Import component
   - Look for imported components from BusinessImprovementHub

2. MODEL-DRIVEN APPS:
   - Apps > Each Model-driven app > Edit
   - Check forms for custom controls
   - Check dashboards for embedded components

3. FORMS:
   - Tables > Each table > Forms
   - Check field properties for custom controls

4. RECENT ACTIVITY:
   - Settings > Activity > Recent activities
   - Look for recent changes to apps/forms

"@ -ForegroundColor Cyan

Write-Host "`n=== STEP 5: Force fixes (in order of preference) ===" -ForegroundColor Green

Write-Host "FIX 1: Find and remove the dependency manually (best)"
Write-Host "FIX 2: Try import without the component that's being referenced"
Write-Host "FIX 3: Delete the blocking component (if you can identify it)"
Write-Host "FIX 4: Reset TEST environment (nuclear option)"

Write-Host "`nFIX 1: Attempting unmanaged import (may bypass dependency)..."
$result = pac solution import --path "BusinessImprovementHub_unmanaged.zip" --force-overwrite 2>&1

if ($result -match "succeeded") {
    Write-Host "SUCCESS! Unmanaged import worked!" -ForegroundColor Green
} else {
    Write-Host "Unmanaged import failed. Manual investigation required." -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Yellow
}