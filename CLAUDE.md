# FPProjectTimelines Component Instructions

## Publishing Requirements
- Always publish with prefix "aubia" using: `pac pcf push --publisher-prefix aubia`
- Increment version numbers in both manifest and app header (keep them in sync)
- Use npm scripts for version management:
  - `npm run version:patch` - for bug fixes
  - `npm run version:minor` - for new features
  - `npm run version:major` - for breaking changes
- Publish workflow: `npm run publish:prep` then `npm run publish:aubia`

## Change Log Requirements
- ALWAYS update the CHANGELOG.md file with notable changes for each version release
- Include version number, date, and description of changes
- Categorize changes as: Added, Changed, Fixed, Removed
- Note any GitHub commits made
- ALWAYS remember to update the Change Log with significant changes

## Component Specific Instructions
- This is a Project Timeline component focused on Gantt-style timeline views
- Shows projects grouped by department with color-coded milestone tracking
- Includes 24-month scrollable timeline with completion percentage visualization
- Milestone filtering by category (General Operations, Supply Chain, DT/IT, HR)
- Uses cr725_ prefixed Dataverse entities for projects and tasks
- Displays aubia_tasktype (0=Task, 1=Milestone) and aubia_category fields

## Development Notes
- Component uses React 16.14.0 with Fluent UI v9
- All styling is inline via TypeScript (no external CSS)
- Maintains compatibility with existing cr725_ prefixed Dataverse entities
- Version synchronization between version.ts and ControlManifest.Input.xml

## Important Reminders
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested