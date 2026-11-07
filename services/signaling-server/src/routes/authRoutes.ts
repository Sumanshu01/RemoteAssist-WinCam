import { Router, Request, Response } from "express";
import { z } from "zod";
import { dbStore } from "../services/dbStore";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  generateRefreshToken,
  hashToken
} from "../utils/security";
import { createRateLimiter } from "../middleware/rateLimiter";
import { authenticateToken, requireAuth } from "../middleware/authMiddleware";
import { logger } from "../utils/logger";

export const authRouter = Router();

// Strict rate limiting on authentication routes (15 attempts per 15 minutes)
const authLimiter = createRateLimiter({ maxRequests: 15, windowMs: 15 * 60 * 1000 });

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["ADMIN", "HELPER", "APPLICANT"]).default("APPLICANT"),
  countryCode: z.string().min(2).max(5).default("IN")
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

const isProd = process.env.NODE_ENV === "production";

function setAuthCookies(res: Response, accessToken: string, refreshToken?: string) {
  res.cookie("raw_session", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  if (refreshToken) {
    res.cookie("raw_refresh", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
}

function clearAuthCookies(res: Response) {
  res.clearCookie("raw_session", { path: "/" });
  res.clearCookie("raw_refresh", { path: "/api/auth" });
}

// ================= POST /api/auth/register =================
authRouter.post("/register", authLimiter, (req: Request, res: Response): void => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Validation failed", details: parse.error.format() });
      return;
    }

    const { email, password, name, role, countryCode } = parse.data;

    if (dbStore.getUserByEmail(email)) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }

    const passwordHash = hashPassword(password);
    const user = dbStore.createUser({
      email,
      passwordHash,
      name,
      role,
      countryCode
    });

    // If applicant, initialize profile
    if (role === "APPLICANT") {
      dbStore.upsertProfile(user.id, {
        targetCountry: countryCode === "IN" ? "CA" : "IN",
        currentStep: 1
      });
    }

    const accessToken = createAccessToken(user);
    const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

    dbStore.saveRefreshSession({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt,
      userAgent: req.headers["user-agent"],
      ipHash: hashToken(req.ip || "unknown")
    });

    setAuthCookies(res, accessToken, refreshToken);

    dbStore.logAuditEvent({
      eventType: "AUTH_REGISTER",
      actorId: user.id,
      actorRole: user.role,
      targetEntity: "User",
      targetId: user.id,
      detailsJson: JSON.stringify({ email: user.email, role: user.role })
    });

    logger.info("User registered successfully", { userId: user.id, role: user.role });

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        countryCode: user.countryCode,
        createdAt: user.createdAt
      },
      token: accessToken
    });
  } catch (err: unknown) {
    logger.error("Error during registration", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= POST /api/auth/login =================
authRouter.post("/login", authLimiter, (req: Request, res: Response): void => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Validation failed", details: parse.error.format() });
      return;
    }

    const { email, password } = parse.data;
    const user = dbStore.getUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const accessToken = createAccessToken(user);
    const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

    dbStore.saveRefreshSession({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt,
      userAgent: req.headers["user-agent"],
      ipHash: hashToken(req.ip || "unknown")
    });

    setAuthCookies(res, accessToken, refreshToken);

    dbStore.logAuditEvent({
      eventType: "AUTH_LOGIN",
      actorId: user.id,
      actorRole: user.role,
      targetEntity: "User",
      targetId: user.id
    });

    logger.info("User logged in successfully", { userId: user.id, role: user.role });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        countryCode: user.countryCode,
        createdAt: user.createdAt
      },
      token: accessToken
    });
  } catch (err: unknown) {
    logger.error("Error during login", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= POST /api/auth/refresh =================
authRouter.post("/refresh", (req: Request, res: Response): void => {
  try {
    const refreshToken = req.cookies?.raw_refresh || req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token is missing" });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const session = dbStore.getRefreshSession(tokenHash);

    if (!session || session.isRevoked || session.expiresAt.getTime() < Date.now()) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Refresh token is invalid or expired" });
      return;
    }

    const user = dbStore.getUserById(session.userId);
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Revoke old refresh session and issue rotated new token
    dbStore.revokeRefreshSession(tokenHash);
    const { token: newRefreshToken, hash: newRefreshHash, expiresAt } = generateRefreshToken();

    dbStore.saveRefreshSession({
      userId: user.id,
      tokenHash: newRefreshHash,
      expiresAt,
      userAgent: req.headers["user-agent"],
      ipHash: hashToken(req.ip || "unknown")
    });

    const newAccessToken = createAccessToken(user);
    setAuthCookies(res, newAccessToken, newRefreshToken);

    dbStore.logAuditEvent({
      eventType: "AUTH_REFRESH",
      actorId: user.id,
      actorRole: user.role,
      targetEntity: "RefreshSession",
      targetId: session.id
    });

    res.json({
      message: "Session token refreshed",
      token: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        countryCode: user.countryCode,
        createdAt: user.createdAt
      }
    });
  } catch (err: unknown) {
    logger.error("Error during token refresh", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= POST /api/auth/logout =================
authRouter.post("/logout", (req: Request, res: Response): void => {
  const refreshToken = req.cookies?.raw_refresh || req.body?.refreshToken;
  if (refreshToken) {
    dbStore.revokeRefreshSession(hashToken(refreshToken));
  }
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ================= GET /api/auth/me =================
authRouter.get("/me", authenticateToken, requireAuth, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});
