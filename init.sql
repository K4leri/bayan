-- CREATE DATABASE tgclient;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE message (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    message JSONB,
    chatid BIGINT NOT NULL,
    groupid BIGINT,
    platform TEXT,
    firstmessageid BIGINT,
    time_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    chatid BIGINT NOT NULL,
    tgchatid BIGINT,
    vkchatid BIGINT,
    username JSONB,
    should_create BOOLEAN DEFAULT TRUE,
    firstmessageid BIGINT,
    time_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS userstat (
    id SERIAL PRIMARY KEY,
    chatid BIGINT NOT NULL UNIQUE,
    bayan JSONB NOT NULL,
    time_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS errors (
  id SERIAL PRIMARY KEY,
  key UUID DEFAULT uuid_generate_v4(),
  chatid BIGINT NOT NULL,
  userid BIGINT NOT NULL,
  platform TEXT,
  count INT,
  message JSONB,
  errorMessage JSONB,
  time_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE OR REPLACE FUNCTION update_last_update_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.last_update = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_userstat_last_update
BEFORE UPDATE ON userstat
FOR EACH ROW
EXECUTE FUNCTION update_last_update_column();
