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

### PostgreSQL + TimescaleDB — larger time-series workloads

Provide a PostgreSQL server with TimescaleDB enabled. The plugin applies `migrations/001_storage.sql` at startup. It creates hypertables/indexes and isolates document ownership by the authenticated caller.

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
