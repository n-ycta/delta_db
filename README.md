# Delta Storage

**One typed storage contract, replaceable backends.** An independent Delta plugin for time-series records and owner-isolated JSON documents.

## Install in one step

The installer includes the node if it is missing. No Rust compiler is needed.

```sh
curl -fsSL https://raw.githubusercontent.com/n-ycta/delta_db/main/install.sh -o delta-db-install.sh
sh delta-db-install.sh
```

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/n-ycta/delta_db/main/install.ps1 -OutFile delta-db-install.ps1
.\delta-db-install.ps1
```

This installs a node + storage. To also get the console, use the [Delta default installer](https://github.com/n-ycta/delta#quick-start), or add Delta Web from its installer.

## Pick your backend

### Local files — instant quick start

Default when no PostgreSQL configuration exists. Atomic private JSON writes, serialized transactions, `(time,id)` deduplication, identical query/document interface. Limit: **100,000 records**; intended for a small personal deployment, not a replacement for a database server. Capacity failure is explicit; records are never silently discarded. Back up the storage data directory.

### PostgreSQL — larger workloads (TimescaleDB optional)

Provide a standard PostgreSQL 15+ server. No TimescaleDB extension or superuser role is required. The plugin applies idempotent tables/indexes from `migrations/001_storage.sql`; existing Timescale hypertables remain compatible. Documents are isolated by the authenticated caller.

In the web console open **Plugins → Delta Storage → Settings**, choose PostgreSQL and supply a connection URL. Confirm the warning: changing backends **does not migrate data**. The candidate connection/migration must succeed before the active backend changes. The URL is written only to the node's private storage directory and is not returned in settings responses. `DATABASE_URL` is also supported for initial deployment.

For a local development server with Docker:

```sh
docker compose up -d
# Inspect compose.yaml and set your own database password before remote use.
```

Use a least-privilege database role with the schema/migration permissions it needs. Enable TLS for remote database connections and do not expose PostgreSQL publicly without proper network controls. Switching to a different plugin/database is possible by implementing the same capabilities; automatic cross-engine migration/replication is not included.

## Contract

| Capability | Purpose |
| --- | --- |
| `storage.health` | Actual backend and status |
| `storage.write` | Up to 1,000 typed records per atomic batch |
| `storage.query` | Source, metric, half-open time range, dimensions, limit |
| `storage.document_put/get/list/delete` | Owner-isolated JSON documents |
| `storage.settings` | Owner-controlled backend configuration |

Records: `id` (UUID), `time` (epoch milliseconds), `source`, `node`, `metric`, finite numeric/null `value`, string `dimensions`, optional JSON `payload`. The source must match the local producer token name; a paired node's records must declare its authenticated peer node ID. Queries use parameter binding in PostgreSQL, never interpolated SQL from clients.

The record read capability is intentionally a storage-level authority. If an AI client needs a narrower source/range policy, expose it through a restricted web MCP profile rather than handing out an unrestricted storage token. Documents cannot spoof their authenticated owner through request arguments.

## Develop

```sh
npm ci
npm test
npm start
```

Node 22.12+, supervisor-provided `DELTA_URL` / `DELTA_TOKEN`, optional `STORAGE_COMPONENT` (default `storage`), `DATA_DIR` and `DATABASE_URL`. Configuration and data files are private; do not commit them. The manifest includes English and Russian presentation metadata; technical IDs stay language-independent.

Licensed under [Apache 2.0](LICENSE). PostgreSQL, TimescaleDB and npm dependencies retain their respective licenses; the Apache license here does not relicense those products.


### Console status contract

The manifest declares generic status/settings endpoints. `storage.status` returns only sanitized settings (`engine` and a boolean connection-configured marker); database credentials never leave the plugin. `storage.settings` without `values` reads the same safe settings; writes remain administrative. The web console no longer needs storage-specific setting logic.

## Storage contract 1.1

`<component>.aggregate` groups records by declared dimension names, optional epoch-aligned time buckets and sum/avg/min/max/count/last/weighted_avg. All PostgreSQL identifiers/JSON paths supplied by a caller are parameter-bound. Weighted averages use a positive numeric payload weight and ignore null measurements. Empty filters mean no restriction. Results include `truncated`; producers must not present partial results as complete.

`<component>.delete` accepts the same source/metric/time/filter scope as query. Non-admin producers can only delete their own source; authenticated peers are additionally node-bound. Type owns its session/word schemas and retention, not Storage.

Test standard PostgreSQL with `TEST_DATABASE_URL=postgres://... npm test`; release CI uses PostgreSQL 16 without TimescaleDB.

## Automatic PostgreSQL and safe backend migration (0.4)

New profiles default to managed PostgreSQL 16 + TimescaleDB 2.24. Existing file profiles are kept on files until an explicitly confirmed migration. File storage is still compatible with Type word counts; changing databases does not grant keyboard access or enable word collection.

In **Storage → Settings**, choose PostgreSQL, enable **Manage local PostgreSQL automatically**, confirm copying/verifying the data, and save. No connection URL is needed. If a runtime is missing, the Storage-owned **Prepare database runtime** action asks for native OS authorization on the target Linux desktop, installs rootless Podman from the distribution's configured repositories, and assigns an unused subordinate UID/GID range if needed. Supported package-manager families: Arch/Omarchy, Debian/Ubuntu, Fedora/RHEL. The web process never runs as root, no docker-group grant is added. A working desktop polkit agent and network/repository access are required. Installation errors remain visible; runtime preparation is not silently retried with elevated privileges.

On Windows, an installed/running Docker Desktop (Linux containers) is required; initial OS/WSL/virtualization setup may need administrator approval and a reboot. The plugin provisions the database itself once the runtime is available; it does not silently accept Docker licensing or change Windows virtualization settings. Existing working Docker or rootless Podman is reused on Linux. Without a runtime you can keep using file storage.

The official multi-architecture Timescale image is pinned by digest. The database is bound only to `127.0.0.1` on an automatically allocated port. Its volume is owned/labeled by this Storage instance. Passwords are generated privately, never returned by status, and never passed in container command-line arguments. Linux directories use mode 0700/files 0600; Windows directories use user/SYSTEM ACLs. The same runtime/container/volume is reused after plugin or node restarts. Removing the plugin does not delete its database volume.

Switching file ↔ PostgreSQL (including an external PostgreSQL URL) runs an asynchronous migration: freeze writes after destination preparation, snapshot the source, back up **both** source and old destination, copy, compare canonical SHA-256 over all records and private documents, then atomically select the destination. Document ownership and dashboards survive both conversions. On failure the source remains selected. Destination Delta tables are replaced with the verified source snapshot; any previous destination data is retained in a private backup. Backups contain sensitive data and are deliberately not automatically deleted. Source data is retained too. File storage currently supports at most 100,000 records; an oversized reverse migration is rejected rather than truncated. Do not stop the node during migration. Producers should retry unavailable writes; Type keeps a durable outbox.

Setup registers the Storage component immediately rather than waiting for a large image download. Setup/migration state and errors are available through `storage.status` and plugin-owned web notices. A failed job can be retried with **Retry database setup**. External URLs are optional and kept private; turn automatic management off only when using your own server.

Validation includes real plain PostgreSQL round trips, failure rollback and owner/Unicode preservation, an actual pinned Timescale container lifecycle and both-direction migration in Linux CI, Windows unit/ACL checks, and live core/Web dashboard migration checks. Native Linux desktop polkit prompts and Docker Desktop/WSL installation require testing on those actual desktops; container CI is not a substitute for that.

## Web and native clients

This is an independent Core plugin, not code embedded in a particular frontend. Compatible Web/Desktop clients discover its manifest and API through the node. A phone can manage a trusted paired desktop/VPS node; it does not run local npm plugins or desktop input collectors. Choose the service/source node explicitly and review the permissions before installation. Missing capabilities remain unavailable rather than being simulated.

