import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { assertNoteEncryptionKey, encryptNote } from "./noteCrypto.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to connect to PostgreSQL");
}

const ca = process.env.AIVEN_CA_CERT?.replace(/\\n/g, "\n").trim();
if (!ca) {
  throw new Error("AIVEN_CA_CERT must contain the Aiven CA certificate");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL database error:", error.message);
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
