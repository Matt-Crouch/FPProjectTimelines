// Simple version update script for FP Project Timelines PCF Component
// Run this script before publishing to increment version numbers

const fs = require('fs');
const path = require('path');

// Read current version
const versionPath = path.join(__dirname, 'version.ts');
const manifestPath = path.join(__dirname, 'FPProjectTimelines', 'ControlManifest.Input.xml');

// Helper function to increment version
function incrementVersion(version, type = 'patch') {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      parts[2]++;
      break;
  }
  
  return parts.join('.');
}

// Read current version from version.ts
const versionContent = fs.readFileSync(versionPath, 'utf8');
const versionMatch = versionContent.match(/version: '([^']+)'/);
const buildMatch = versionContent.match(/buildNumber: (\d+)/);

if (!versionMatch || !buildMatch) {
  console.error('Could not parse current version from version.ts');
  process.exit(1);
}

const currentVersion = versionMatch[1];
const currentBuild = parseInt(buildMatch[1]);

// Get update type from command line (default: patch)
const updateType = process.argv[2] || 'patch';
const newVersion = incrementVersion(currentVersion, updateType);
const newBuild = currentBuild + 1;
const timestamp = new Date().toISOString();

console.log(`Updating version from ${currentVersion} to ${newVersion}`);
console.log(`Updating build from ${currentBuild} to ${newBuild}`);

// Update version.ts file
const newVersionContent = versionContent
  .replace(/version: '[^']+'/, `version: '${newVersion}'`)
  .replace(/buildNumber: \d+/, `buildNumber: ${newBuild}`)
  .replace(/lastUpdated: '[^']+'/, `lastUpdated: '${timestamp}'`);

fs.writeFileSync(versionPath, newVersionContent);

// Update ControlManifest.Input.xml - specifically target the control version, not XML version
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const newManifestContent = manifestContent.replace(
  /<control([^>]+)version="[^"]+"/,
  `<control$1version="${newVersion}"`
);

fs.writeFileSync(manifestPath, newManifestContent);

console.log('✅ Version updated successfully!');
console.log(`New version: ${newVersion} (Build ${newBuild})`);
console.log('Files updated:');
console.log('  - version.ts');
console.log('  - ControlManifest.Input.xml');
console.log('');
console.log('Next steps:');
console.log('  1. npm run build');
console.log('  2. pac pcf push --publisher-prefix aubia');