CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS delta_records (
 time TIMESTAMPTZ NOT NULL, id UUID NOT NULL, source TEXT NOT NULL, node TEXT NOT NULL,
 metric TEXT NOT NULL, value DOUBLE PRECISION, dimensions JSONB NOT NULL DEFAULT '{}', payload JSONB NOT NULL DEFAULT '{}',
 PRIMARY KEY(time,id)
);
SELECT create_hypertable('delta_records','time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS delta_records_lookup ON delta_records(source,metric,time DESC);
CREATE INDEX IF NOT EXISTS delta_records_dims ON delta_records USING GIN(dimensions);
CREATE TABLE IF NOT EXISTS delta_documents (
 namespace TEXT NOT NULL, key TEXT NOT NULL, owner TEXT NOT NULL, value JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(namespace,key,owner)
);
