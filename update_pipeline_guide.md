# How to Update Your Deployment Pipeline

## First: Identify Your Pipeline Type

### Azure DevOps Pipelines (Most Common)
- URL looks like: `https://dev.azure.com/yourorg/yourproject/_build`
- Uses YAML files or Classic Editor
- Has build/release pipelines

### Power Platform Pipelines (Newer)
- Configured in Power Platform admin center
- URL: `https://admin.powerplatform.microsoft.com`
- Navigate to: Environments → Pipelines

### GitHub Actions
- Repository has `.github/workflows/` folder
- YAML files for deployment automation

### Manual Process
- Someone manually exports/imports solutions

## How to Update Each Type:

### 1. Azure DevOps Pipelines

#### If using YAML pipeline:
1. **Find the YAML file** (usually in your repo root or `.azure-pipelines/`)
2. **Look for the solution export step**:
   ```yaml
   - task: PowerPlatformExportSolution@2
     inputs:
       SolutionName: 'BusinessImprovementHub'
       SolutionOutputPath: '$(Build.ArtifactStagingDirectory)'
   ```
3. **Ensure it exports fresh each time** (not using cached files)
4. **Add force refresh if needed**:
   ```yaml
   - task: PowerPlatformExportSolution@2
     inputs:
       SolutionName: 'BusinessImprovementHub'
       SolutionOutputPath: '$(Build.ArtifactStagingDirectory)'
       Managed: true
       AsyncOperation: true
   ```

#### If using Classic Editor:
1. **Go to**: Azure DevOps → Pipelines → Releases
2. **Edit your release pipeline**
3. **Find the "Export Solution" task**
4. **Verify it's exporting from DEV environment**
5. **Clear any cached artifacts**

### 2. Power Platform Pipelines

1. **Go to**: https://admin.powerplatform.microsoft.com
2. **Navigate**: Environments → Pipelines
3. **Find your pipeline** (usually named for your solution)
4. **Click "Run pipeline"** - it should automatically export fresh from DEV
5. **If it fails**: Check the pipeline configuration

### 3. GitHub Actions

1. **Check `.github/workflows/` folder** in your repository
2. **Find the deployment workflow file**
3. **Look for solution export action**:
   ```yaml
   - name: Export solution
     uses: microsoft/powerplatform-actions/export-solution@v0
     with:
       solution-name: BusinessImprovementHub
       solution-output-file: solution.zip
   ```
4. **Ensure no cached solution files are being used**

## Quick Test Method

### Option 1: Check if Pipeline Auto-Exports
Most modern pipelines export fresh from DEV each time:
1. **Run your pipeline now**
2. **Check the logs** for "Exporting solution from..."
3. **If it exports fresh**: It should work with your clean DEV solution
4. **If it uses cached file**: You need to update it

### Option 2: Manual Pipeline Update
If your pipeline uses a stored solution file:
1. **Replace the solution file** with `BusinessImprovementHub_CLEAN_v48_FINAL.zip`
2. **Upload to your artifact storage** (Azure DevOps artifacts, GitHub releases, etc.)
3. **Update pipeline to use the new file**

## Common Pipeline Locations

Tell me which of these applies to you:

1. **Azure DevOps**: Do you have access to dev.azure.com?
2. **Power Platform Admin**: Do you see pipelines in admin.powerplatform.microsoft.com?
3. **GitHub**: Is your code in a GitHub repository with Actions?
4. **SharePoint/File Share**: Does someone manually manage solution files?
5. **Other**: Different deployment method?

## What Information I Need

To help you specifically:
1. **Where do you access your pipeline?** (URL or location)
2. **Who usually manages deployments?** (You, DevOps team, etc.)
3. **How often do you deploy?** (Helps identify the type)
4. **Do you see build/release logs anywhere?**

Once you tell me your pipeline type, I can give you specific step-by-step instructions to update it.