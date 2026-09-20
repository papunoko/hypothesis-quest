import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NotebookEntry } from "./notebook-types.ts";
import type { Submission } from "./review.ts";
import type { Narration } from "./narration.ts";

export function openNotebook(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notebook (seq INTEGER PRIMARY KEY, session TEXT NOT NULL, id TEXT NOT NULL, entry TEXT NOT NULL, UNIQUE(session, id)); CREATE INDEX IF NOT EXISTS notebook_session ON notebook(session, seq);");
  db.exec("CREATE TABLE IF NOT EXISTS submissions (seq INTEGER PRIMARY KEY, session TEXT NOT NULL, id TEXT NOT NULL, entry TEXT NOT NULL, UNIQUE(session, id));");
  return {
    list(session: string): NotebookEntry[] {
      return db.prepare("SELECT entry FROM notebook WHERE session = ? ORDER BY seq").all(session).map((row) => JSON.parse(row.entry as string));
    },
    append(session: string, entry: NotebookEntry) {
      db.prepare("INSERT INTO notebook(session, id, entry) VALUES (?, ?, ?) ON CONFLICT(session, id) DO NOTHING").run(session, entry.id, JSON.stringify(entry));
    },
    saveHint(session: string, id: string, hint: Narration) {
      const row = db.prepare("SELECT entry FROM notebook WHERE session = ? AND id = ?").get(session, id);
      if (!row) return;
      const entry = JSON.parse(row.entry as string) as NotebookEntry;
      db.prepare("UPDATE notebook SET entry = ? WHERE session = ? AND id = ?").run(JSON.stringify({ ...entry, hint }), session, id);
    },
    submissions(session: string): Submission[] {
      return db.prepare("SELECT entry FROM submissions WHERE session = ? ORDER BY seq").all(session).map((row) => JSON.parse(row.entry as string));
    },
    submit(session: string, submission: Submission) {
      db.prepare("INSERT INTO submissions(session, id, entry) VALUES (?, ?, ?) ON CONFLICT(session, id) DO NOTHING").run(session, submission.id, JSON.stringify(submission));
      return JSON.parse(db.prepare("SELECT entry FROM submissions WHERE session = ? AND id = ?").get(session, submission.id)!.entry as string) as Submission;
    },
    close() { db.close(); },
  };
}

let instance: ReturnType<typeof openNotebook> | undefined;
export function notebook() { return instance ??= openNotebook(join(process.cwd(), "data", "notebook.sqlite")); }
