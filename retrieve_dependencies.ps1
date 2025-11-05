# PowerShell script to retrieve dependencies for the problematic CustomControl
# This script uses the Dataverse Web API to find what's referencing the control

Write-Host "=== Retrieving dependencies for CustomControl ff2cff1b-9940-4d09-b57f-f5fb2e47aad6 ===" -ForegroundColor Cyan

# First, ensure you're connected to the TEST environment
Write-Host "`nChecking current environment connection..."
$orgInfo = pac org who

if ($orgInfo -match "Full Asset Potential Test" -or $orgInfo -match "test") {
    Write-Host "Connected to TEST environment" -ForegroundColor Green
} else {
    Write-Host "WARNING: You may not be connected to TEST environment" -ForegroundColor Yellow
    Write-Host "Current connection: $orgInfo"
    Write-Host "`nTo switch to TEST environment, run:"
    Write-Host "pac auth create --environment [TEST_ENVIRONMENT_URL]" -ForegroundColor Cyan
    Write-Host "`nPress Enter to continue anyway, or Ctrl+C to exit..."
    Read-Host
}

# Use pac CLI to retrieve dependencies
Write-Host "`n=== Method 1: Using PAC CLI to query dependencies ==="

# Export the solution with dependencies information
Write-Host "Exporting solution with dependency information..."
pac solution export --name BusinessImprovementHub --path "./test_with_deps.zip" --include-dependencies

# Extract and analyze
if (Test-Path "./test_with_deps.zip") {
    Expand-Archive -Path "./test_with_deps.zip" -DestinationPath "./test_deps" -Force

    # Look for dependency information
    $dependencyFiles = @(
        "./test_deps/solution.xml",
        "./test_deps/customizations.xml",
        "./test_deps/[Content_Types].xml"
    )

    foreach ($file in $dependencyFiles) {
        if (Test-Path $file) {
            Write-Host "Checking $file for dependencies..."
            $content = Get-Content $file -Raw
            if ($content -match "ff2cff1b-9940-4d09-b57f-f5fb2e47aad6") {
                Write-Host "FOUND in $file" -ForegroundColor Red
            }
        }
    }
}

Write-Host "`n=== Method 2: Manual Investigation Steps ==="
Write-Host @"

To manually find what's referencing this control in your TEST environment:

1. Go to Power Apps Maker Portal (make.powerapps.com)
2. Select your TEST environment
3. Navigate to Solutions > Open "Default Solution"
4. Go to "Custom controls" in the left menu
5. Search for controls with the GUID or related to "MyTaskWidget"

ALTERNATIVE: Check Model-Driven Apps
1. In Power Apps Maker Portal
2. Go to Apps
3. For each Model-driven app:
   - Click ... > Edit
   - Check Forms for custom control configurations
   - Look for any fields using custom controls

CHECK FORMS:
1. Go to Tables > Select each table used in your solution
2. Open Forms for each table
3. Check each form field for custom control configurations
4. Look for fields that might be using the old MyTaskWidget control

"@ -ForegroundColor Cyan

Write-Host "`n=== Method 3: Force Remove Dependencies ==="
Write-Host @"

If you can't find the dependency, you can try:

1. NUCLEAR OPTION - Reset TEST environment:
   - Export any critical data first
   - Reset the environment to remove all customizations
   - Re-import your solutions

2. Create a holding solution:
   - Create a new unmanaged solution in TEST
   - Add the problematic control to it if it exists
   - Delete the holding solution (this sometimes clears stuck references)

3. Use Solution Checker:
   - Run solution checker on your exported solution
   - It may identify the hidden dependency

"@ -ForegroundColor Yellow

Write-Host "`n=== Method 4: Direct API Query (Advanced) ==="
Write-Host "Creating API query script..." -ForegroundColor Green

# Create a separate script for API query
@'
# Direct API Query to find dependencies
# Run this in a browser console while logged into your TEST environment

// Get the Dataverse API endpoint
const apiUrl = window.location.origin + "/api/data/v9.2/";

// Query for the specific control
fetch(apiUrl + "customcontrols?$filter=customcontrolid eq 'ff2cff1b-9940-4d09-b57f-f5fb2e47aad6'")
  .then(response => response.json())
  .then(data => {
    console.log("Control found:", data);

    // Now query for dependencies
    const dependencyQuery = {
      "ObjectId": "ff2cff1b-9940-4d09-b57f-f5fb2e47aad6",
      "ComponentType": 66 // 66 is the component type for CustomControl
    };

    return fetch(apiUrl + "RetrieveDependenciesForDelete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(dependencyQuery)
    });
  })
  .then(response => response.json())
  .then(dependencies => {
    console.log("Dependencies found:", dependencies);
    dependencies.EntityCollection.Entities.forEach(dep => {
      console.log(`Component ${dep.RequiredComponentNodeId} (Type: ${dep.RequiredComponentType}) references this control`);
    });
  })
  .catch(error => console.error("Error:", error));
'@ | Out-File -FilePath "./find_dependencies_browser.js"

Write-Host "Browser script created: find_dependencies_browser.js" -ForegroundColor Green
Write-Host "Copy the contents and run in browser console while in TEST environment" -ForegroundColor Yellow