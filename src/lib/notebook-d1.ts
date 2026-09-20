import type { NotebookEntry } from "./notebook-types.ts";
import type { D1DatabaseSession } from "@cloudflare/workers-types";
import type { Submission } from "./review.ts";
import type { Narration } from "./narration.ts";

export function openNotebook(db: Pick<D1DatabaseSession, "prepare" | "batch">) {
  return {
    async list(session: string): Promise<NotebookEntry[]> {
      const rows = await db.prepare("SELECT entry FROM notebook WHERE session = ? ORDER BY seq").bind(session).all<{ entry: string }>();
      return rows.results.map((row) => JSON.parse(row.entry));
    },
    async append(session: string, entry: NotebookEntry) {
      await db.prepare("INSERT INTO notebook(session, id, entry) VALUES (?, ?, ?) ON CONFLICT(session, id) DO NOTHING").bind(session, entry.id, JSON.stringify(entry)).run();
    },
    async saveHint(session: string, id: string, hint: Narration) {
      // Update only the hint, without overwriting a concurrent change to other fields.
      await db.prepare("UPDATE notebook SET entry = json_set(entry, '$.hint', json(?)) WHERE session = ? AND id = ?").bind(JSON.stringify(hint), session, id).run();
    },
    async submissions(session: string): Promise<Submission[]> {
      const rows = await db.prepare("SELECT entry FROM submissions WHERE session = ? ORDER BY seq").bind(session).all<{ entry: string }>();
      return rows.results.map((row) => JSON.parse(row.entry));
    },
    async submit(session: string, submission: Submission): Promise<Submission> {
      const results = await db.batch<{ entry: string }>([
        db.prepare("INSERT INTO submissions(session, id, entry) VALUES (?, ?, ?) ON CONFLICT(session, id) DO NOTHING").bind(session, submission.id, JSON.stringify(submission)),
        db.prepare("SELECT entry FROM submissions WHERE session = ? AND id = ?").bind(session, submission.id),
      ]);
      const row = results[1].results[0];
      if (!row) throw new Error("Submission was not saved");
      return JSON.parse(row.entry);
    },
  };
}
