import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { assertNoteEncryptionKey, encryptNote } from "./noteCrypto.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to connect to Neon");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (error) => {
  console.error("Unexpected Neon database error:", error.message);
});

export function query(text, values) {
  return pool.query(text, values);
}

export async function initializeDatabase() {
  assertNoteEncryptionKey();
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, note FROM notes WHERE note_encrypted = false FOR UPDATE",
    );

    for (const row of rows) {
      await client.query(
        "UPDATE notes SET note = $1, note_encrypted = true WHERE id = $2",
        [encryptNote(row.note), row.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
