# Changelog

All notable changes to the FPProjectTimelines PCF component will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-11-05

### Fixed
- Fixed milestone display issue where only milestones with resource assignments were shown
- Now displays ALL milestones including those without resource assignments
- Modified data loading to fetch and store all tasks separately from resource-assigned tasks

### Changed
- Updated fetchResourceData to return both resources and all tasks
- Project timeline now builds from all tasks instead of only assigned tasks
- Improved console logging to show total tasks including unassigned

## [1.0.2] - 2025-11-05

### Fixed
- Fixed version update script to reference correct component folder (FPProjectTimelines)

### Changed
- Published to PowerApps with aubia prefix
- Initialized GitHub repository with initial commit
- Updated version synchronization between manifest and app header

## [1.0.0] - 2025-11-05

### Added
- Initial Release - Project Timeline Dashboard split from FPResourceManagement
- Gantt-style project timeline view with department swimlanes
- 24-month scrollable timeline with horizontal navigation
- Project bars with completion percentage visualization
- Color-coded milestone tracking with category filtering
