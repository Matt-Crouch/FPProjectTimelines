# Manual Steps to Find Blocking Component

Since the GUID `58432372-41f3-4edf-a613-c03f4a995b86` isn't visible in the UI, let's use systematic elimination:

## Method 1: Check All Custom Controls in TEST

1. **Go to**: make.powerapps.com → TEST environment
2. **Navigate**: Solutions → Default Solution → Custom controls
3. **List all controls you see**:
   - Write down ALL the control names
   - Note which ones look suspicious
   - Any that mention "Task", "Widget", "Dashboard", etc.

## Method 2: Check Your BusinessImprovementHub Solution

1. **Navigate**: Solutions → BusinessImprovementHub
2. **Look at**: Custom controls section
3. **Compare**: What's in your solution vs what should be there

Expected controls in your solution should be:
- aubia_Aubia.FPResourceManagement (your main component)
- Maybe some Fluent UI or other standard controls

## Method 3: Process of Elimination

Since the error happens during deployment, the problematic component is likely:

### Most Likely Candidates:
1. **MyTaskWidget control** (we know this is problematic)
2. **Dashboard-related controls**
3. **Any control with "aubia" prefix that shouldn't be there**
4. **Controls that were manually added to TEST**

### How to Check Each Control:
1. In Custom controls list, click each control name
2. Look for:
   - Controls that seem out of place
   - Controls you don't recognize
   - Recently added controls
   - Controls with error states

## Method 4: Check Forms for Custom Control Usage

The blocking could be a form field using a custom control:

1. **Go to**: Tables → (your main tables)
2. **For each table**: Open the main form
3. **Check each field**:
   - Click field → Properties → Controls tab
   - Look for any custom controls configured
   - Note any that seem problematic

## Method 5: Check Canvas Apps

1. **Go to**: Apps
2. **For each Canvas app**: Edit → Insert → Custom → Components
3. **Look for**: Any imported components that shouldn't be there

## What to Report Back

Tell me:
1. **All custom control names** you see in Default Solution
2. **All custom control names** you see in BusinessImprovementHub solution
3. **Any forms** that have custom controls configured
4. **Any Canvas apps** that have custom components imported

This will help us identify what's causing the blocking reference.