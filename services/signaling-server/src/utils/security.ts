import crypto from "crypto";
import { AppRole, UserAccount } from "@remoteassist/shared-types";

const JWT_SECRET = process.env.JWT_SECRET || "remoteassist-wincam-secure-jwt-signing-key-2026";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TokenPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: AppRole;
  countryCode: string;
  iat: number;
  exp: number;
}

/**
 * Hash password using Node.js built-in scrypt with unique salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify password using timingSafeEqual to prevent timing attacks
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Create base64url encoded HMAC-SHA256 token
 */
export function createAccessToken(user: UserAccount): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Date.now();
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    countryCode: user.countryCode,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ACCESS_TOKEN_TTL_MS) / 1000)
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify access token and return payload
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate cryptographically secure random refresh token
 */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, hash, expiresAt };
}

/**
 * Hash token using SHA-256 for secure database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Redact sensitive fields (passwords, tokens, identity documents) from logs & payloads
 */
export function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "password",
    "passwordhash",
    "token",
    "refreshtoken",
    "secret",
    "ssn",
    "passport",
    "identitydocument",
    "authorization"
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      sanitized[key] = redactSensitiveData(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
