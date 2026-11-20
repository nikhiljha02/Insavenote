import { Client, Pool } from "pg";
import { getContext } from "../runtime/context.js";
import { assertNoteEncryptionKey, encryptNote } from "./noteCrypto.js";

// Local development: use your existing Aiven connection.
const localPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.AIVEN_CA_CERT
        ? {
            ca: process.env.AIVEN_CA_CERT.replace(/\\n/g, "\n").trim(),
            rejectUnauthorized: true,
          }
        : undefined,
    })
  : null;

if (localPool) {
  localPool.on("error", (error) => {
    console.error("PostgreSQL error:", error.message);
  });
}

// Shared query function for local development and Cloudflare Workers.
export async function query(text, values = []) {
  const context = getContext();

  // Cloudflare Worker: connect through Hyperdrive.
  if (context?.env?.HYPERDRIVE) {
    const client = new Client({
      connectionString: context.env.HYPERDRIVE.connectionString,
    });

    try {
      await client.connect();
      return await client.query(text, values);
    } finally {
      await client.end();
    }
  }

  // Local development: use the existing PostgreSQL pool.
  if (localPool) {
    return localPool.query(text, values);
  }

  throw new Error("No PostgreSQL connection is available");
}

// Local development only.
// Never call this during Cloudflare Worker startup.
export async function initializeDatabase() {
  if (!localPool) {
    throw new Error("Database initialization is only available locally");
  }

  assertNoteEncryptionKey();

  const { readFile } = await import("node:fs/promises");

  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );

  await localPool.query(schema);

  const client = await localPool.connect();

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

export default localPool;
