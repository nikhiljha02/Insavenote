import express from "express";
import authRoute from "./Routes/route.js";
import notesRoute from "./Routes/noteRoute.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import pool, { initializeDatabase, query } from "./database/db.js";
import rateLimit from "express-rate-limit";
import connectPgSimple from "connect-pg-simple";

const app = express();
const PgSessionStore = connectPgSimple(session);

app.set("trust proxy", 1);

await initializeDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  cors({
    origin: process.env.FRONTEND_LIVE_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.disable("x-powered-by");

//rate limit

// app.use(
//   "/api/auth",
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     limit: 30,
//     standardHeaders: "draft-7",
//     legacyHeaders: false,
//   }),
// );

// Session middleware
app.use(
  session({
    name: "connect.sid",
    store: new PgSessionStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      // The cookie is fixed at seven days (rolling defaults to false), so touching
      // the session row on every note request only adds an unnecessary DB write.
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

// Health check
app.get("/api/health", async (req, res) => {
  const start = Date.now();
  try {
    const dbStart = Date.now();
    await query("SELECT 1");

    const dbTime = Date.now() - dbStart;
    const totalTime = Date.now() - start;
    res.json({
      status: "success",
      databaseTime: `${dbTime}ms`,
      totalTime: `${totalTime}ms`,
    });
  } catch {
    return res.status(500).json({
      message: "Neon database connection failed",
    });
  }
});

// API routes
app.use("/api/auth", authRoute);
app.use("/note", notesRoute);

// Export app for Vercel
export default app;

// Local development
if (process.env.VERCEL !== "1") {
  const port = process.env.PORT || 8080;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
