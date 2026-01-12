# Changelog

## [2.1.0]

### Added

- **Multi-package manager support**: Added support for pnpm, bun, and deno in addition to npm and yarn. The CLI now automatically detects the package manager used in your project by examining lock files and the `packageManager` field in `package.json`.

### Changed

- **Automatic package manager detection**: Replaced manual yarn/npm detection with the `package-manager-detector` library for more robust and comprehensive package manager support.
- **Dynamic install commands**: Install commands are now dynamically generated based on the detected package manager (e.g., `pnpm add`, `bun add`, `yarn add`, `npm install`).
- **Dynamic run scripts**: The `fetch:generate` script in `package.json` now uses the appropriate run command for the detected package manager (e.g., `pnpm run`, `bun run`, `yarn run`, `npm run`).
