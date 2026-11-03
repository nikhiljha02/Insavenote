# Backend setup

The backend connects to Neon PostgreSQL through `DATABASE_URL`. Copy `.env.example` to `.env` and set your Neon connection string, session secret, and Google OAuth client ID.

On startup, the backend runs `database/schema.sql` to create or add the application tables and indexes, then encrypts any existing plaintext notes. The session store uses the same Neon connection and creates `user_sessions` when needed.

Set `NOTES_ENCRYPTION_KEY` to a dedicated 32-byte key encoded as base64 (generate one with `openssl rand -base64 32`). AES-256-GCM encrypts note text before it is written to Neon. Keep the same key in local and deployment environment settings; changing or losing it makes encrypted notes unreadable. Existing plaintext notes are migrated automatically at startup.

Google profile image URLs are stored in `users.picture`; Neon is used only for database storage.

The schema setup does not copy existing rows from Supabase. Export and import previous users and notes separately if you need them in Neon.
