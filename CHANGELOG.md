# Changelog

## Release policy

- Collect compatible fixes in **Unreleased**; do not publish a separate release for every small commit.
- Publish tested, meaningful batches only after explicit maintainer approval.
- Before tagging, move the reviewed changes into a version section below. Release workflows require that section.
- Historical patch releases have been consolidated into the next retained release. Git tags remain available for source history and comparison links.

## [Unreleased]

- No pending changes.

## [v0.4.2]

- Start fresh personal installations with durable file Storage, not an unavailable container prerequisite.
- Preserve explicit/existing managed PostgreSQL selections; never replace them with empty files.
- Retry transient PostgreSQL/runtime outages automatically; retain data and existing backend during failures.
- Select managed PostgreSQL explicitly in its real-container test.
- Verify file restart persistence and outage recovery with regression tests.

## [v0.4.0]

This release focuses on managed databases and verified storage migration.

### Features
- Provision and configure a managed local PostgreSQL + TimescaleDB container without manually entering a database URL.
- Support verified migration from local files to PostgreSQL and back before switching the active backend.
- Keep an external PostgreSQL connection available as an optional advanced configuration.

### Improvements
- Report managed-runtime prerequisites and document rootless setup, migration guarantees and platform requirements.

### Bug Fixes
- Preserve the live file cache when saved settings do not change the backend.
- Replace the old no-migration acknowledgment flow with verified transfer and target backups.
- Localize owned validation errors for missing connections and backend-switch confirmation.

### Security
- Use private database credentials, local-only managed access and native Windows ACLs for sensitive files/backups.

### Notes
- Managed provisioning requires a usable Docker or rootless Podman runtime.
- Migration verifies the target before activation and preserves the source; destination capacity limits still apply.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Full Changelog:** https://github.com/n-ycta/delta_db/compare/v0.3.1...v0.4.0

## [v0.3.1]

Includes changes from v0.3.0 through v0.3.1.

### Features
- Generic dimension/time-bucket aggregation, including weighted averages, for file and PostgreSQL backends.
- Producer-scoped record deletion for plugin-owned retention.
- Support standard PostgreSQL without requiring TimescaleDB.

### Improvements
- Report query truncation so consumers do not silently present incomplete results.
- Keep business schemas and retention policy in producer plugins rather than hard-coding Type tables into Storage.

### Bug Fixes
- Align root/UI manifests, package and lockfile versions, correcting the superseded v0.3.0 packaging build.

### Security
- Parameter-bind caller-supplied grouping/filter values and enforce producer/node ownership for deletion.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Full Changelog:** https://github.com/n-ycta/delta_db/compare/v0.2.2...v0.3.1

## [v0.2.2]

Includes changes from v0.2.0 through v0.2.2.

### Features
- Replaceable Storage for typed producer records and document data.
- PostgreSQL/TimescaleDB and durable local-file backends.
- Generic status/settings endpoints, English/Russian presentation and actionable API/tool schemas.

### Improvements
- Describe record writes, query filters/time ranges and document operations for typed clients.
- Let Web render Storage settings from the plugin contract without storage-specific UI policy.

### Security
- Bind peer records to authenticated node provenance.
- Expose a sanitized connection-configured marker, not database connection secrets, and keep settings writes administrative.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Source:** https://github.com/n-ycta/delta_db/tree/v0.2.2

