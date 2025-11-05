// Version information for FP Project Timelines PCF Component
// This file should be updated whenever the component is published

export const VERSION_INFO = {
  version: '1.0.2',
  buildNumber: 3,
  lastUpdated: new Date().toISOString(),
  description: 'Initial release - Project Timeline Dashboard with Milestone Tracking',
  
  // Helper function to get display version
  getDisplayVersion: () => `v${VERSION_INFO.version}`,
  
  // Helper function to get full version with build number
  getFullVersion: () => `v${VERSION_INFO.version} (Build ${VERSION_INFO.buildNumber})`,
  
  // Helper function for manifest version (removes 'v' prefix)
  getManifestVersion: () => VERSION_INFO.version
};

// Export individual components for convenience
export const { version, buildNumber, lastUpdated, description } = VERSION_INFO;