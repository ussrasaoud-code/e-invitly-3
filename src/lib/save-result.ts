export type SaveResult = { ok: true; savedAt: string } | { ok: false; message: string; issues?: string[] };
