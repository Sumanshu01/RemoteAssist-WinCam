import { Request, Response, NextFunction } from "express";
import { AppRole, UserAccount } from "@remoteassist/shared-types";
import { verifyAccessToken } from "../utils/security";

declare global {
  namespace Express {
    interface Request {
      user?: UserAccount;
    }
  }
}

/**
 * Authentication middleware: reads token from HTTP-only cookie or Authorization header
 */
export function authenticateToken(req: Request, _res: Response, next: NextFunction): void {
  const tokenFromCookie = req.cookies?.raw_session;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  const token = tokenFromCookie || tokenFromHeader;

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        countryCode: payload.countryCode,
        createdAt: new Date(payload.iat * 1000).toISOString()
      };
    }
  }

  next();
}

/**
 * Guard requiring valid authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Valid authentication token is required"
    });
    return;
  }
  next();
}

/**
 * Role-Based Access Control Guard
 */
export function requireRoles(...allowedRoles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}, Current: ${req.user.role}`
      });
      return;
    }

    next();
  };
}

/**
 * Strict Applicant Isolation Guard:
 * Prevents Applicant A from viewing or modifying Applicant B's profile, workflows, or checklists.
 * Helpers and Admins can access assigned applicants.
 */
export function requireApplicantIsolation(getApplicantId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      return;
    }

    const targetApplicantId = getApplicantId(req);

    // Helpers and Admins are permitted to support any assigned applicant
    if (req.user.role === "ADMIN" || req.user.role === "HELPER") {
      next();
      return;
    }

    // Applicants can ONLY access their own records
    if (req.user.role === "APPLICANT") {
      if (!targetApplicantId || targetApplicantId !== req.user.id) {
        res.status(403).json({
          error: "Forbidden",
          message: "Applicant isolation violation: Access to other applicant records is forbidden"
        });
        return;
      }
    }

    next();
  };
}
