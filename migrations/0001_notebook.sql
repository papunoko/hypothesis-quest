CREATE TABLE IF NOT EXISTS notebook (
  seq INTEGER PRIMARY KEY,
  session TEXT NOT NULL,
  id TEXT NOT NULL,
  entry TEXT NOT NULL CHECK(json_valid(entry)),
  UNIQUE(session, id)
);
CREATE INDEX IF NOT EXISTS notebook_session ON notebook(session, seq);
CREATE TABLE IF NOT EXISTS submissions (
  seq INTEGER PRIMARY KEY,
  session TEXT NOT NULL,
  id TEXT NOT NULL,
  entry TEXT NOT NULL CHECK(json_valid(entry)),
  UNIQUE(session, id)
);
CREATE INDEX IF NOT EXISTS submissions_session ON submissions(session, seq);
