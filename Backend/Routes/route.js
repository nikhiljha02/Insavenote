import { Router } from "express";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { query } from "../database/db.js";
import { loginUser, signupUser } from "../middleware/zodLayer.js";
import authenticateToken from "../middleware/authCheck.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

async function startUserSession(req, userId) {
    await regenerateSession(req);
    req.session.userId = userId;
    await saveSession(req);
}

function publicUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        picture: row.picture || "",
    };
}

router.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("connect.sid", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });
        return res.json({ message: "Logged out successfully" });
    });
});

router.get("/getMe", async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const { rows } = await query("SELECT id, name, email, picture FROM users WHERE id = $1", [req.session.userId]);
        if (!rows[0]) {
            return res.status(401).json({ message: "User not found" });
        }
        return res.json({ clientUser: publicUser(rows[0]) });
    } catch (error) {
        return next(error);
    }
});

router.post("/google", async (req, res, next) => {
    try {
        const { credential } = req.body;
        if (typeof credential !== "string" || credential.length > 10000) {
            return res.status(400).json({ message: "Google credential is required" });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload?.sub || !payload.email || payload.email_verified !== true) {
            return res.status(401).json({ message: "Google account could not be verified" });
        }

        const googleId = payload.sub;
        const email = payload.email.trim().toLowerCase();
        let dbUser;
        try {
            const result = await query(
                `INSERT INTO users ("googleId", name, email, picture)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("googleId") DO UPDATE
         SET name = EXCLUDED.name,
             email = EXCLUDED.email,
             picture = EXCLUDED.picture
         RETURNING id, "googleId", name, email, picture`,
                [googleId, payload.name || email, email, payload.picture || ""],
            );
            dbUser = result.rows[0];
        } catch (error) {
            if (error.code !== "23505") throw error;
            return res.status(409).json({
                message: "An account with this email already exists. Sign in using your existing method and link Google securely.",
            });
        }

        await startUserSession(req, dbUser.id);
        return res.json({ user: publicUser(dbUser) });
    } catch (error) {
        console.error("Google login error:", error.message);
        if (error.message?.includes("Wrong recipient") || error.message?.includes("Invalid token")) {
            return res.status(401).json({ message: "Invalid Google credential" });
        }
        return next(error);
    }
});

export default router;
