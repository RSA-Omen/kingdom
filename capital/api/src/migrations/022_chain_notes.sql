-- Chain enrichment notes.
-- Stores structured notes added by the king (or agents) to any Guild Board item.
-- item_id is either an Asana task GID or "incident:{id}".
-- For Asana tasks, the note is also posted as an Asana comment (handled by the API).

CREATE TABLE IF NOT EXISTS chain_notes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id   TEXT    NOT NULL,           -- Asana GID or "incident:{id}"
  author    TEXT    NOT NULL DEFAULT 'king',
  text      TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_chain_notes_item_id  ON chain_notes (item_id);
CREATE INDEX IF NOT EXISTS idx_chain_notes_created_at ON chain_notes (created_at);
