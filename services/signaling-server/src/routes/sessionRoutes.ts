import { Router, Request, Response } from "express";
import { sessionStore } from "../services/sessionStore";
import { ConsentManager } from "../services/consentManager";
import { UserRole, RegionInfo, IceServerConfig } from "@remoteassist/shared-types";
import { config } from "../config";

export const sessionRouter = Router();

// Create new assist session
sessionRouter.post("/", (req: Request, res: Response): void => {
  try {
    const { title, initiatorName, initiatorRole, initiatorRegion, targetRegion } = req.body;

    if (!initiatorName || !initiatorRole || !initiatorRegion) {
      res.status(400).json({
        error: "Missing required fields: initiatorName, initiatorRole, initiatorRegion"
      });
      return;
    }

    const session = sessionStore.createSession({
      title,
      initiatorName,
      initiatorRole: initiatorRole as UserRole,
      initiatorRegion: initiatorRegion as RegionInfo,
      targetRegion: targetRegion as RegionInfo
    });

    res.status(201).json({
      session,
      invitation: {
        sessionCode: session.sessionCode,
        inviteUrl: `/session/${session.id}?code=${session.sessionCode}`,
        expiresAt: session.expiresAt
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Get session by ID
sessionRouter.get("/:id", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = sessionStore.getSessionById(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ session });
});

// Resolve session by code (e.g. RAW-123-456)
sessionRouter.get("/code/:code", (req: Request, res: Response): void => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const session = sessionStore.getSessionByCode(code);
  if (!session) {
    res.status(404).json({ error: "Invalid session code" });
    return;
  }
  res.json({ session });
});

// Record or update consent
sessionRouter.post("/:id/consent", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId, role, status, scope } = req.body;
  const session = sessionStore.updateConsent({
    sessionId,
    userId,
    role,
    status,
    scope
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    session,
    streamingAllowed: ConsentManager.isStreamingAllowed(sessionId)
  });
});

// Revoke consent
sessionRouter.post("/:id/revoke", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId, role, reason } = req.body;
  const session = ConsentManager.revokeConsent(
    sessionId,
    userId,
    role || "SENDER",
    reason || "User manually clicked revoke"
  );

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ session, message: "Consent revoked. Session terminated." });
});

// Terminate session
sessionRouter.post("/:id/terminate", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { terminatedBy, reason } = req.body;
  const session = sessionStore.terminateSession(
    sessionId,
    terminatedBy || "system",
    reason || "User ended session"
  );

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ session });
});

// Audit logs
sessionRouter.get("/:id/audit-logs", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const logs = sessionStore.getAuditLogs(sessionId);
  res.json({ logs });
});

// Support Messages: GET /api/sessions/:id/messages
sessionRouter.get("/:id/messages", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const messages = sessionStore
    .getAuditLogs(sessionId)
    .filter((l) => l.eventType === "STREAM_STARTED" || l.eventType === "CONSENT_GRANTED");
  // Also fetch any in-memory support chat messages
  res.json({ messages });
});

// Support Messages: POST /api/sessions/:id/messages
sessionRouter.post("/:id/messages", (req: Request, res: Response): void => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { senderId, senderName, senderRole, content } = req.body;

  if (!content || !senderName) {
    res.status(400).json({ error: "Missing senderName or content" });
    return;
  }

  // Redact any inadvertent passwords, tokens, or credentials in message text
  const sanitizedContent = content
    .replace(/(password|secret|token|ssn|auth)[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]");

  sessionStore.logAudit({
    sessionId,
    eventType: "STREAM_STARTED",
    actorId: senderId || "anonymous",
    actorRole: senderRole || "SENDER",
    details: { senderName, content: sanitizedContent }
  });

  res.status(201).json({
    message: {
      id: "msg_" + Math.random().toString(36).substring(2, 10),
      sessionId,
      senderId,
      senderName,
      senderRole,
      content: sanitizedContent,
      timestamp: new Date().toISOString()
    }
  });
});

// Dynamic WebRTC ICE Configuration (STUN + TURN, credentials strictly from server environment)
sessionRouter.get("/:id/ice-servers", (_req: Request, res: Response): void => {
  const dynamicIceServers: IceServerConfig[] = config.stunServers
    .filter(Boolean)
    .map((url) => ({ urls: url.trim() }));

  if (config.turnServer.url && config.turnServer.username) {
    dynamicIceServers.push({
      urls: config.turnServer.url,
      username: config.turnServer.username,
      credential: config.turnServer.credential
    });
  }

  res.json({
    iceServers: dynamicIceServers,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  });
});
