# Pipeline Deployment Fix Instructions

## Problem Summary
The Canvas App `cr725_mytasks_7a8ec` was causing deployment failures. We've removed it from DEV, but your pipeline might still be using an old cached solution file.

## Current Status
- ✅ **DEV Solution**: Clean (v1.2.2.45) - Canvas App removed
- ✅ **TEST Solution**: Updated (v1.2.2.43) - Manual import worked
- ❌ **Pipeline**: Still failing - likely using old solution file

## Fix Instructions

### Option 1: Azure DevOps Pipeline (Most Common)
If using Azure DevOps:

1. **Check your pipeline YAML/Classic Editor**:
   - Look for the solution export step
   - Ensure it's not using a cached/stored solution file
   - It should export fresh from DEV each time

2. **Clear pipeline cache**:
   ```yaml
   # Add this to force fresh export
   - task: PowerPlatformExportSolution@2
     inputs:
       authenticationType: 'PowerPlatformSPN'
       PowerPlatformSPN: 'your-connection'
       SolutionName: 'BusinessImprovementHub'
       SolutionOutputPath: '$(Build.ArtifactStagingDirectory)'
       Managed: true
       AsyncOperation: true
       MaxAsyncWaitTime: 60
   ```

3. **Or manually update the solution file**:
   - Upload `BusinessImprovementHub_pipeline_ready.zip` to your pipeline artifacts
   - Update pipeline to use this file

### Option 2: Power Platform Pipelines
If using Power Platform native pipelines:

1. **Trigger a new deployment**:
   - The pipeline should automatically export from DEV
   - Since DEV is now clean, it should work

2. **If still failing**:
   - Check pipeline configuration for any custom pre-export steps
   - Ensure no solution segmentation is including old Canvas Apps

### Option 3: GitHub Actions
If using GitHub Actions:

1. **Update your workflow file**:
   ```yaml
   - name: Export solution from DEV
     uses: microsoft/powerplatform-actions/export-solution@v0
     with:
       environment-url: 'https://fullpotentialdev.crm4.dynamics.com/'
       solution-name: BusinessImprovementHub
       managed: true
       solution-output-file: solution.zip
   ```

2. **Clear GitHub Actions cache**:
   ```bash
   gh cache delete --all
   ```

## Verification Steps

1. **Check what solution file your pipeline is using**:
   - Look at pipeline logs for the export/import steps
   - Verify the solution file timestamp
   - Check if it contains the Canvas App

2. **Test the pipeline**:
   - Run the pipeline
   - Check the logs for the specific error
   - If it mentions `cr725_mytasks_7a8ec` or Canvas App deletion, the old file is still being used

## Clean Solution Files Available

- `BusinessImprovementHub_pipeline_ready.zip` (v1.2.2.45) - Latest from DEV, clean
- `BusinessImprovementHub_clean_v1.2.2.42.zip` - Earlier clean version

## If Pipeline Still Fails

The error might be different now. Check for:
1. Different component causing issues
2. Permission problems
3. Environment-specific dependencies

Run this command to check the exact error:
```bash
pac solution import --path "your-solution.zip" --verbose --log-file import_log.txt
```

## Contact Points
- Pipeline logs should show the exact error
- Power Platform admin center → Solution history shows detailed errors
- If error is different from Canvas App issue, we've made progress!