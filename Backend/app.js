import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoute from "./Routes/route.js";
import notesRoute from "./Routes/noteRoute.js";
import pool from "./database/db.js";
import { query } from "./database/db.js";
import { KVSessionStore } from "./runtime/kvSessionStore.js";
import { runWithContext } from "./runtime/context.js";

const PgSessionStore = connectPgSimple(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(workerEnv = null) {
  const app = express();
  const isWorker = Boolean(workerEnv);

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    runWithContext({ env: workerEnv }, next);
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!isWorker) {
    app.use(express.static(path.join(__dirname, "public")));
  }

  app.use(
    cors({
      origin: process.env.FRONTEND_LIVE_URL || "http://localhost:5173",
      credentials: true,
    }),
  );

  app.use(
    session({
      name: "connect.sid",
      store: isWorker
        ? new KVSessionStore()
        : new PgSessionStore({
            pool,
            tableName: "user_sessions",
            createTableIfMissing: true,
            disableTouch: true,
          }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.get("/api/health", async (req, res) => {
    const start = Date.now();

    try {
      const dbStart = Date.now();
      await query("SELECT 1");

      res.json({
        status: "success",
        databaseTime: `${Date.now() - dbStart}ms`,
        totalTime: `${Date.now() - start}ms`,
      });
    } catch (error) {
      console.error("Health check error:", error.message);
      res.status(500).json({
        message: "Database connection failed",
      });
    }
  });

  app.use("/api/auth", authRoute);
  app.use("/note", notesRoute);

  return app;
}
