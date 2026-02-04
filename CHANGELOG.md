# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [unreleased]

### Added

- **Set up job wizard** — A step-by-step flow to set work zero (X, Y, Z) and optional tool reference before running a job. You choose how to set XY zero and Z zero (manual, touch plate, BitZero, BitSetter), then the wizard guides you through each step with clear instructions and progress.
- **Ways to start job setup** — “Set up job” button in the File panel (when a file is loaded, above Outline), and pressing Run on the Setup page opens the wizard and then starts the job when you finish.
- **Settings for default setup behavior** — In Settings you can pick default methods for work XY zero, work Z zero, and what to do at tool changes during a job (e.g. BitSetter, touch plate, or ask each time).
- **Touch plate and BitZero options** — Touch plate can be set per axis (X, Y, or Z); BitZero can be used for XY only, Z only, or combined XYZ. BitSetter has a short sequence: verify circuit, move to BitSetter, then probe.
- **Tool changes during a job** — When the job asks for a tool change, you can use your chosen method (e.g. BitSetter or touch plate) or be asked each time. The same setup steps are used in the tool change flow.
- **Setup wizard as a tab** — The Set up job flow appears as a tab next to the 3D view when open. BitSetter tool reference is shown in the Debug panel.
- **More reliable probing and actions** — Probing, outline tracing, and macros now wait properly for the machine to finish instead of relying on timeouts.
- **Auto place model after zeroing** — After you set X, Y, or Z zero in the setup wizard, the 3D view automatically repositions the loaded model to match the new work zero.
- **Debug options** — In the Debug panel you can enable “Allow next toolchange screen” to step through setup and tool change screens without completing each step (for testing).
- **Updated help and translations** — Documentation and translated text for the new setup and zeroing options.

### Changed

- Default left panel order on Setup page: DRO, Jog, Joystick, File, Rapid, Spindle, Probe, Macros, Camera, Debug.

### Removed

- Old zeroing strategy keys: `initialSetup`, `toolChange`, `afterPause`.
- Feeder:status/serialport:read useEffects and long timeouts in blocks and ZeroingWizardTab (replaced by runGcodeBatch).

### Fixed


## [0.0.88]

### Added
- Using gzip for .deb packages to handle older Raspberry Pis

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




[unreleased]: https://github.com/rsteckler/AxioCNC/compare/v0.0.88...HEAD
[0.0.88]: https://github.com/rsteckler/AxioCNC/releases/tag/v0.0.88
[0.0.87]: https://github.com/rsteckler/AxioCNC/releases/tag/v0.0.87
[0.0.50]: https://github.com/rsteckler/AxioCNC/releases/tag/v0.0.50