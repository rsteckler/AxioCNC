# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- VFD spindle warmup (fixes [#33](https://github.com/rsteckler/AxioCNC/issues/33)): optional warmup sequence for VFD spindles to redistribute grease before use. When enabled in Settings → Machine, the Spindle panel shows a Warmup button that steps through configurable min/max/step RPM with configurable dwell time at each speed. Warmup can be stopped via Stop Warmup or by the spindle stopping (e.g. e-stop); Start/Stop Spindle is hidden during warmup.

- Added localization for:
-- English
-- Spanish
-- French
-- Italian
-- Czech
-- Dutch
-- Hungarian
-- German
-- Japanese
-- Norwegian
-- Porteugese
-- Russian
-- Turkish
-- Ukranian
-- Chinese (simplified and traditional)


## [0.0.87] - 2026-01-26

### Added

- Comprehensive developer documentation covering the full contributor workflow, from setup to PR submission
  - Start Here guide with project overview and principles
  - Getting Set Up with prerequisites and common fixes
  - Repository Map explaining codebase structure
  - Day-1 Developer Workflow with dev/test/build flows
  - Architecture documentation with system diagrams
  - Code Standards and Testing Strategy guides
  - Contributing guide with PR process and conventions
  - Release Process and CI/CD documentation
  - Troubleshooting FAQ and Reference materials

### Changed

### Removed


## [0.0.50] - 2026-01-21

### Added

- Initial release in Github to test CI pipeline and artifact packaging.  Not intended for actual usage.

### Fixed


### Changed


### Removed




[unreleased]: https://github.com/rsteckler/AxioCNC/compare/v0.0.50...HEAD
[0.0.87]: https://github.com/rsteckler/AxioCNC/releases/tag/v0.0.87
[0.0.50]: https://github.com/rsteckler/AxioCNC/releases/tag/v0.0.50