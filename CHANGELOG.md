# Changelog

All notable changes to the claude-autopilot marketplace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions track the `autopilot` plugin (`plugins/autopilot/.claude-plugin/plugin.json`),
which is kept in lockstep with the marketplace manifest's `metadata.version`.

## [Unreleased]

### Added

- Quality and release infrastructure: `package.json` scripts (`validate`, `format`,
  `lint`, `link-check`, `check`, `fix`, `audit`), Prettier + markdownlint + lychee
  configuration, and a `scripts/validate-manifests.mjs` checker that enforces the
  marketplace's structural invariants on every push.
- CI workflows (`.github/workflows/ci.yml`, `.github/workflows/link-check.yml`) and
  Dependabot configuration.
- Maintainer documentation: `CONTRIBUTING.md` and `docs/maintainers.md` (versioning
  policy and release checklist).

## [0.4.0] - 2026

### Changed

- Restructured documentation into plain-language guides under `docs/`
  (`getting-started`, `concepts`, `use-cases`, `power-ups`, `autonomous-runs`).

## [0.3.0] - 2026

### Added

- `pr_ci` mode now handles target repositories that have no base-branch CI,
  scaffolding `.github/workflows/` from `templates/ci-gate.yml.tmpl` when needed.

## [0.2.0] - 2026

### Added

- Initial release of the `autopilot` marketplace and plugin: the `plan`, `detect`,
  `run-phase`, and `orchestrate` skills; thin slash-command wrappers; and the
  `.autopilot/` templates.

[Unreleased]: https://github.com/agentic-incubator/claude-autopilot/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/agentic-incubator/claude-autopilot/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/agentic-incubator/claude-autopilot/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/agentic-incubator/claude-autopilot/releases/tag/v0.2.0
