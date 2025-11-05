# Investigation Commands for Deployment Issue

The GUID `ff2cff1b-9940-4d09-b57f-f5fb2e47aad6` is being referenced by another component in your **test environment**.

## Step 1: Switch to Test Environment

```bash
# List your environments
pac env list

# Switch to test environment
pac auth create --environment [TEST_ENVIRONMENT_URL]
```

## Step 2: Find What's Referencing the Control

### Check Custom Controls in Test Environment
```bash
# Export all solutions to see which might contain the problematic control
pac solution list

# Export the BusinessImprovementHub solution from TEST to examine it
pac solution export --name BusinessImprovementHub --path "./test_solution.zip" --managed false
```

### Check Form Configurations
The GUID likely represents a custom control that's configured on a form field. Look for:

1. **Forms that use custom controls** - Go to Power Apps maker portal in TEST environment
2. **Navigate to Tables > Forms**
3. **Check each form** for fields that have custom controls configured
4. **Look for any fields** that show errors or reference "MyTaskWidget" or similar

### Check Canvas Apps in Test Environment
```bash
# List all canvas apps
pac canvas list

# Check if any canvas apps reference the control
```

## Step 3: Alternative Solution Approach

Since the reference exists in TEST but not DEV, you have two options:

### Option A: Clean Test Environment
1. **Delete the problematic component** from TEST environment manually
2. **Remove any forms/apps** that reference it
3. **Retry the deployment**

### Option B: Force Import
```bash
# Try force import (may overwrite conflicts)
pac solution import --path "BusinessImprovementHub.zip" --force-overwrite
```

## Step 4: Common Places to Check

1. **System Forms** - Check all entity forms for custom control configurations
2. **Canvas Apps** - Any canvas apps that embed PCF controls
3. **Model-Driven Apps** - Check app configurations
4. **Other Solutions** - Another solution might depend on this control

## Immediate Action

Run this command in your TEST environment to get more details:

```bash
# Get detailed error information
pac solution import --path "BusinessImprovementHub.zip" --verbose --log-file import_log.txt
```

The verbose log should tell you exactly which component is causing the reference issue.