# Script to identify the new blocking component
Write-Host "=== IDENTIFYING NEW BLOCKING COMPONENT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEW PROBLEMATIC GUID: 58432372-41f3-4edf-a613-c03f4a995b86" -ForegroundColor Red
Write-Host ""

# Connect to TEST environment
Write-Host "Make sure you're connected to TEST environment..." -ForegroundColor Yellow
pac auth list

Write-Host "`n=== Browser Console Script ===" -ForegroundColor Green
Write-Host "Copy and run this in browser console at make.powerapps.com (TEST environment):" -ForegroundColor Yellow

@'
// Script to identify what component 58432372-41f3-4edf-a613-c03f4a995b86 is
// Run this in browser console at make.powerapps.com (TEST environment)

const apiUrl = window.location.origin + "/api/data/v9.2/";
const targetGuid = "58432372-41f3-4edf-a613-c03f4a995b86";

// Check custom controls
fetch(`${apiUrl}customcontrols?$filter=customcontrolid eq '${targetGuid}'`)
  .then(response => response.json())
  .then(data => {
    if (data.value && data.value.length > 0) {
      console.log("FOUND CUSTOM CONTROL:", data.value[0]);
      console.log("Name:", data.value[0].name);
      console.log("Display Name:", data.value[0].displayname);

      // Now get what's referencing it
      return fetch(`${apiUrl}RetrieveDependenciesForDelete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "ObjectId": targetGuid,
          "ComponentType": 66
        })
      });
    } else {
      console.log("Not found as CustomControl, checking other types...");
    }
  })
  .then(response => response.json())
  .then(dependencies => {
    if (dependencies && dependencies.EntityCollection) {
      console.log("DEPENDENCIES FOUND:");
      dependencies.EntityCollection.Entities.forEach(dep => {
        console.log("- Component using this control:", dep);
      });
    }
  })
  .catch(error => console.error("Error:", error));
'@ | Out-File -FilePath "./find_new_component.js" -Encoding UTF8

Write-Host "`nBrowser script saved as: find_new_component.js" -ForegroundColor Green

Write-Host "`n=== Quick PowerShell Check ===" -ForegroundColor Yellow
Write-Host "Searching for this GUID in our solution files..." -ForegroundColor Cyan

# Search in current directory for the GUID
$files = Get-ChildItem -Path "." -Include "*.xml", "*.json" -Recurse -ErrorAction SilentlyContinue
$found = $false

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "58432372-41f3-4edf-a613-c03f4a995b86") {
        Write-Host "FOUND in: $($file.FullName)" -ForegroundColor Red
        $found = $true
    }
}

if (-not $found) {
    Write-Host "GUID not found in local solution files" -ForegroundColor Green
    Write-Host "This component exists only in TEST environment" -ForegroundColor Yellow
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host @"

1. Run the browser console script to identify what this component is
2. Check in TEST environment:
   - Solutions > Default Solution > Custom Controls
   - Look for control with GUID 58432372-41f3-4edf-a613-c03f4a995b86

3. Common culprits:
   - Another PCF control that was added to TEST
   - A control that's configured on a form
   - A control used in a Canvas App

4. To find what's using it:
   - Check all forms for custom control configurations
   - Check Canvas Apps for imported components
   - Check Model-driven apps for custom controls

"@ -ForegroundColor White

Write-Host "`n=== IMPORTANT ===" -ForegroundColor Red
Write-Host @"

Since we fixed the first GUID issue and now have a different one,
it appears there are MULTIPLE components in TEST that are blocking deployment.

These components are NOT in your DEV solution, which means:
1. Someone added them directly to TEST
2. They were part of another solution
3. They're orphaned/corrupted references

You may need to clean up TEST environment completely.

"@ -ForegroundColor Yellow