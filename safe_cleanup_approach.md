# Safe Cleanup Approach (Preserves All Data)

## Option 1: Remove Only Problematic Components (Safest)

### Step 1: Identify the Blocking Component
Connect to TEST and run in browser console:

```javascript
const apiUrl = window.location.origin + "/api/data/v9.2/";
const targetGuid = "58432372-41f3-4edf-a613-c03f4a995b86";

// Find the component
fetch(`${apiUrl}customcontrols?$filter=customcontrolid eq '${targetGuid}'`)
  .then(response => response.json())
  .then(data => {
    if (data.value && data.value.length > 0) {
      console.log("Component found:", data.value[0].name);
      console.log("Display name:", data.value[0].displayname);
    }
  });
```

### Step 2: Find What's Using It
```javascript
// Find dependencies
fetch(`${apiUrl}RetrieveDependenciesForDelete`, {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    "ObjectId": "58432372-41f3-4edf-a613-c03f4a995b86",
    "ComponentType": 66
  })
})
.then(response => response.json())
.then(deps => console.log("Dependencies:", deps));
```

### Step 3: Remove the References
Based on what you find:
- If it's a form field: Edit the form, remove custom control
- If it's a Canvas App: Edit the app, remove the component
- If it's another solution: Check which solution owns it

### Step 4: Delete the Component
In Power Apps maker portal:
1. Solutions > Default Solution
2. Custom Controls
3. Find and delete the problematic control

## Option 2: Export Data First (Very Safe)
```bash
# Export all your table data first
pac data export --environment https://fullpotentialtest.crm4.dynamics.com/ --table cr725_bihub_ideas --file ideas_backup.json
pac data export --environment https://fullpotentialtest.crm4.dynamics.com/ --table cr725_projecttasks --file tasks_backup.json
# ... export other critical tables

# Then do solution delete/reimport
pac solution delete --name BusinessImprovementHub
pac solution import --path "BusinessImprovementHub_CLEAN_v48_FINAL.zip"
```

## Option 3: Staged Upgrade (Microsoft's Safe Method)
```bash
# Instead of delete, use staged upgrade
pac solution import --path "BusinessImprovementHub_CLEAN_v48_FINAL.zip" --stage-and-upgrade
```

This creates a holding solution and upgrades safely.

## Recommendation
Try **Option 1 first** - just remove the specific problematic components.
Only use solution deletion if that doesn't work.