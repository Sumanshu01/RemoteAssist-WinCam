import { Router, Request, Response } from "express";
import { z } from "zod";
import { dbStore } from "../services/dbStore";
import { authenticateToken, requireAuth, requireRoles } from "../middleware/authMiddleware";
import { logger } from "../utils/logger";

export const invitationRouter = Router();

const createInviteSchema = z.object({
  applicantEmail: z.string().email("Valid applicant email is required"),
  targetCountry: z.string().default("CA"),
  expiresInMinutes: z.number().int().min(5).max(1440).default(60) // 5m to 24h
});

// POST /api/invitations (HELPER or ADMIN only)
invitationRouter.post(
  "/",
  authenticateToken,
  requireAuth,
  requireRoles("ADMIN", "HELPER"),
  (req: Request, res: Response): void => {
    try {
      const parse = createInviteSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "Validation failed", details: parse.error.format() });
        return;
      }

      const { applicantEmail, targetCountry, expiresInMinutes } = parse.data;

      const invitation = dbStore.createInvitation({
        helperId: req.user!.id,
        helperName: req.user!.name,
        applicantEmail,
        targetCountry,
        expiresInMinutes
      });

      dbStore.logAuditEvent({
        eventType: "INVITATION_CREATED",
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntity: "SupportInvitation",
        targetId: invitation.id,
        detailsJson: JSON.stringify({
          code: invitation.code,
          applicantEmail: invitation.applicantEmail,
          expiresAt: invitation.expiresAt
        })
      });

      logger.info("Support invitation created", {
        code: invitation.code,
        helperId: req.user!.id
      });

      res.status(201).json({
        message: "Support invitation created successfully",
        invitation: {
          id: invitation.id,
          code: invitation.code,
          token: invitation.token,
          inviteUrl: `/join?token=${invitation.token}&code=${invitation.code}`,
          expiresAt: invitation.expiresAt,
          applicantEmail: invitation.applicantEmail,
          targetCountry: invitation.targetCountry
        }
      });
    } catch (err: unknown) {
      logger.error("Error creating invitation", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/invitations/validate/:token (Public / Applicant endpoint)
invitationRouter.get("/validate/:token", (req: Request, res: Response): void => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const invitation = dbStore.getInvitationByToken(token);

  if (!invitation) {
    res.status(404).json({ valid: false, error: "Invitation not found" });
    return;
  }

  if (invitation.isUsed) {
    res.status(410).json({
      valid: false,
      error: "This invitation link has already been used (single-use limit)"
    });
    return;
  }

  const isExpired = new Date(invitation.expiresAt).getTime() < Date.now();
  if (isExpired) {
    res.status(410).json({ valid: false, error: "This invitation link has expired" });
    return;
  }

  res.json({
    valid: true,
    invitation: {
      code: invitation.code,
      helperId: invitation.helperId,
      helperName: invitation.helperName,
      applicantEmail: invitation.applicantEmail,
      targetCountry: invitation.targetCountry,
      expiresAt: invitation.expiresAt
    }
  });
});

// POST /api/invitations/accept (Accept & create linked support session)
invitationRouter.post(
  "/accept",
  authenticateToken,
  requireAuth,
  (req: Request, res: Response): void => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: "Invitation token is required" });
        return;
      }

      const consumed = dbStore.useInvitation(token);
      if (!consumed) {
        res.status(400).json({
          error: "Invitation is invalid, expired, or has already been consumed"
        });
        return;
      }

      // Create linked support session
      const session = dbStore.createSupportSession({
        invitationId: consumed.id,
        helperId: consumed.helperId,
        applicantId: req.user!.id
      });

      dbStore.logAuditEvent({
        eventType: "INVITATION_ACCEPTED",
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntity: "SupportSession",
        targetId: session.id,
        detailsJson: JSON.stringify({
          invitationCode: consumed.code,
          sessionCode: session.sessionCode
        })
      });

      res.status(201).json({
        message: "Invitation accepted. Support session ready for consent handshake.",
        session
      });
    } catch (err: unknown) {
      logger.error("Error accepting invitation", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
