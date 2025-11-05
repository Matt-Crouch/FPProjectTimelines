# PowerShell script to find what's referencing the problematic control GUID
# Run this in your TEST environment after switching with pac auth

Write-Host "=== Finding references to CustomControl GUID ff2cff1b-9940-4d09-b57f-f5fb2e47aad6 ==="

# Step 1: Export the current BusinessImprovementHub solution from TEST environment
Write-Host "Exporting BusinessImprovementHub solution from TEST environment..."
pac solution export --name BusinessImprovementHub --path "./test_bihub.zip" --managed false

if (Test-Path "./test_bihub.zip") {
    # Extract the solution
    Write-Host "Extracting solution to examine contents..."
    Expand-Archive -Path "./test_bihub.zip" -DestinationPath "./test_solution" -Force

    # Search for the GUID in all files
    Write-Host "Searching for GUID ff2cff1b-9940-4d09-b57f-f5fb2e47aad6..."
    $files = Get-ChildItem -Path "./test_solution" -Recurse -Include "*.xml", "*.json"

    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        if ($content -match "ff2cff1b-9940-4d09-b57f-f5fb2e47aad6") {
            Write-Host "FOUND REFERENCE in: $($file.FullName)" -ForegroundColor Red
            # Show the line containing the GUID
            $lines = Get-Content $file.FullName
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "ff2cff1b-9940-4d09-b57f-f5fb2e47aad6") {
                    Write-Host "Line $($i+1): $($lines[$i])" -ForegroundColor Yellow
                }
            }
        }
    }

    # Also search for variations without hyphens
    Write-Host "Searching for GUID without hyphens: ff2cff1b99404d09b57ff5fb2e47aad6..."
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        if ($content -match "ff2cff1b99404d09b57ff5fb2e47aad6") {
            Write-Host "FOUND REFERENCE (no hyphens) in: $($file.FullName)" -ForegroundColor Red
            $lines = Get-Content $file.FullName
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "ff2cff1b99404d09b57ff5fb2e47aad6") {
                    Write-Host "Line $($i+1): $($lines[$i])" -ForegroundColor Yellow
                }
            }
        }
    }

    Write-Host "Search complete. If no references found, the issue might be in form configurations or canvas apps."
} else {
    Write-Host "Failed to export solution. Make sure you're connected to the TEST environment." -ForegroundColor Red
}

# Step 2: Try to get more specific error details
Write-Host "`n=== Attempting import with verbose logging ==="
pac solution import --path "BusinessImprovementHub.zip" --verbose --log-file "import_error.log"

if (Test-Path "import_error.log") {
    Write-Host "Check import_error.log for detailed error information"
    Get-Content "import_error.log" | Select-String -Pattern "ff2cff1b", "referenced", "cannot be deleted"
}