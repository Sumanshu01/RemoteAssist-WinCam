import { Server, Socket } from "socket.io";
import {
  JoinRoomPayload,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcIceCandidate,
  WebRtcSignalIceRestart,
  SessionTerminationPayload,
  IceServerConfig,
  ConsentRequestPayload,
  ConsentResponsePayload,
  ConsentRevocationPayload,
  UserRole
} from "@remoteassist/shared-types";
import { sessionStore } from "../services/sessionStore";
import { dbStore } from "../services/dbStore";
import { ConsentManager } from "../services/consentManager";
import { verifyAccessToken, redactSensitiveData } from "../utils/security";
import { logger } from "../utils/logger";
import { config } from "../config";

interface PeerConnectionState {
  socketId: string;
  userId: string;
  userName: string;
  role: UserRole;
  joinedAt: number;
  disconnectedAt?: number;
}

export function setupSignalingHandlers(io: Server) {
  const roomPeers = new Map<string, Map<string, PeerConnectionState>>(); // sessionId -> (socketId -> state)
  const reconnectGraceMap = new Map<string, NodeJS.Timeout>(); // userId -> reconnect timer

  io.on("connection", (socket: Socket) => {
    let currentSessionId: string | null = null;
    let currentUserRole: UserRole | null = null;
    let currentUserId: string | null = null;

    // ================= Join Room with Strict Membership Validation =================
    socket.on(
      "join-room",
      (payload: JoinRoomPayload, callback?: (res: Record<string, unknown>) => void) => {
        const { sessionId, sessionCode, role, userName, region, authToken, invitationToken } =
          payload;
        currentSessionId = sessionId;
        currentUserRole = role;

        const effectiveCode =
          sessionCode || (sessionId && sessionId.startsWith("RAW-") ? sessionId : undefined);
        let session =
          sessionStore.getSessionById(sessionId) ||
          (effectiveCode ? sessionStore.getSessionByCode(effectiveCode) : undefined) ||
          sessionStore.getSessionByCode(sessionId) ||
          dbStore.getSupportSessionById(sessionId);

        // In development / demo testing, if a valid format RAW-xxx-xxx corridor code is requested but not in store, auto-provision it
        if (!session && effectiveCode && process.env.NODE_ENV !== "production") {
          session = sessionStore.createSession({
            title: "Auto-Provisioned Support Corridor",
            initiatorName: userName || "Support Specialist",
            initiatorRole: role,
            initiatorRegion: region || {
              countryCode: "CA",
              countryName: "Canada",
              timezone: "America/Toronto"
            }
          });
          sessionStore.registerSessionCode(effectiveCode, session.id);
        }

        if (!session) {
          dbStore.logAuditEvent({
            eventType: "UNAUTHORIZED_SIGNALING_ATTEMPT",
            actorId: "unknown",
            actorRole: String(role),
            targetEntity: "Session",
            targetId: sessionId,
            detailsJson: JSON.stringify({ reason: "Session not found", userName })
          });
          if (callback) callback({ success: false, error: "Session not found" });
          return;
        }

        // 1. Session Expiration Check
        const sessionExpiryStr =
          "expiresAt" in session ? (session as { expiresAt?: string }).expiresAt : null;
        const expiresAt = sessionExpiryStr
          ? new Date(sessionExpiryStr).getTime()
          : Date.now() + 1800000;
        if (expiresAt < Date.now()) {
          if (callback) callback({ success: false, error: "Session has expired" });
          return;
        }

        // 2. Room Membership Authorization Check
        let isAuthenticated = false;
        let authenticatedUserId = "usr_" + socket.id.substring(0, 8);

        if (authToken) {
          const tokenPayload = verifyAccessToken(authToken);
          if (tokenPayload) {
            isAuthenticated = true;
            authenticatedUserId = tokenPayload.sub;
            currentUserRole = tokenPayload.role;
          }
        } else if (invitationToken) {
          const invitation = dbStore.getInvitationByToken(invitationToken);
          if (
            invitation &&
            !invitation.isUsed &&
            new Date(invitation.expiresAt).getTime() >= Date.now()
          ) {
            isAuthenticated = true;
          }
        } else if (process.env.NODE_ENV !== "production") {
          // In development test suites, allow simulation if explicitly provided with test user
          isAuthenticated = true;
        }

        if (!isAuthenticated) {
          dbStore.logAuditEvent({
            eventType: "UNAUTHORIZED_SIGNALING_ATTEMPT",
            actorId: userName || socket.id,
            actorRole: String(role),
            targetEntity: "Session",
            targetId: sessionId,
            detailsJson: JSON.stringify({ reason: "Missing valid auth token or invitation token" })
          });

          logger.warn("Unauthorized signaling connection rejected", { sessionId, userName });
          socket.emit("error", "Unauthorized room access: valid token required");
          if (callback) {
            callback({
              success: false,
              error: "UNAUTHORIZED: Valid session authentication or invitation token required"
            });
          }
          return;
        }

        currentUserId = authenticatedUserId;
        socket.join(sessionId);

        // Track room peers
        if (!roomPeers.has(sessionId)) {
          roomPeers.set(sessionId, new Map());
        }
        const peers = roomPeers.get(sessionId)!;

        // Check if reconnecting
        const wasReconnecting = reconnectGraceMap.has(authenticatedUserId);
        if (wasReconnecting) {
          clearTimeout(reconnectGraceMap.get(authenticatedUserId)!);
          reconnectGraceMap.delete(authenticatedUserId);
        }

        peers.set(socket.id, {
          socketId: socket.id,
          userId: authenticatedUserId,
          userName,
          role,
          joinedAt: Date.now()
        });

        // Register or update participant in session store
        const updated = sessionStore.joinSession({
          sessionId,
          participantName: userName,
          role,
          region
        });

        // Broadcast to room
        socket.to(sessionId).emit(wasReconnecting ? "peer-reconnected" : "peer-joined", {
          sessionId,
          role,
          userName,
          region,
          userId: authenticatedUserId,
          timestamp: new Date().toISOString()
        });

        if (callback) {
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

          callback({
            success: true,
            session: updated || session,
            turnConfig: {
              iceServers: dynamicIceServers,
              iceTransportPolicy: "all",
              bundlePolicy: "max-bundle",
              rtcpMuxPolicy: "require"
            }
          });
        }
      }
    );

    // ================= WebRTC Offer (Sanitized) =================
    socket.on("signal-offer", (payload: WebRtcSignalOffer) => {
      if (!payload.sessionId) return;
      // Guarantee no credentials or identity documents in SDP payload
      const sanitized = redactSensitiveData(payload as unknown as Record<string, unknown>);
      socket.to(payload.sessionId).emit("signal-offer", sanitized);
    });

    // ================= WebRTC Answer (Sanitized) =================
    socket.on("signal-answer", (payload: WebRtcSignalAnswer) => {
      if (!payload.sessionId) return;
      const sanitized = redactSensitiveData(payload as unknown as Record<string, unknown>);
      socket.to(payload.sessionId).emit("signal-answer", sanitized);
    });

    // ================= WebRTC ICE Candidate (Sanitized) =================
    socket.on("signal-ice", (payload: WebRtcIceCandidate) => {
      if (!payload.sessionId) return;
      const sanitized = redactSensitiveData(payload as unknown as Record<string, unknown>);
      socket.to(payload.sessionId).emit("signal-ice", sanitized);
    });

    // ================= WebRTC ICE Restart =================
    socket.on("signal-ice-restart", (payload: WebRtcSignalIceRestart) => {
      if (!payload.sessionId) return;
      logger.info("ICE Restart requested for room", {
        sessionId: payload.sessionId,
        senderId: payload.senderId
      });
      socket.to(payload.sessionId).emit("signal-ice-restart", payload);
    });

    // ================= WebRTC Diagnostics Telemetry =================
    socket.on("signal-diagnostics", (payload: { sessionId: string; diagnostics: unknown }) => {
      if (!payload.sessionId) return;
      socket.to(payload.sessionId).emit("peer-diagnostics", payload.diagnostics);
    });

    // ================= Consent Request =================
    socket.on("consent-request", (payload: ConsentRequestPayload) => {
      if (!payload.sessionId) return;
      socket.to(payload.sessionId).emit("consent-request", payload);
    });

    // ================= Consent Response =================
    socket.on("consent-response", (payload: ConsentResponsePayload) => {
      if (!payload.sessionId) return;

      const updatedSession = sessionStore.updateConsent({
        sessionId: payload.sessionId,
        userId: payload.userId,
        role: payload.role,
        status: payload.decision,
        scope: payload.scope
      });

      // Broadcast updated consent state to both parties in the room
      io.to(payload.sessionId).emit("consent-updated", {
        sessionId: payload.sessionId,
        session: updatedSession,
        streamingAllowed: ConsentManager.isStreamingAllowed(payload.sessionId)
      });
    });

    // ================= Consent Revocation =================
    socket.on("consent-revoke", (payload: ConsentRevocationPayload) => {
      if (!payload.sessionId) return;

      const updated = ConsentManager.revokeConsent(
        payload.sessionId,
        payload.userId,
        currentUserRole || "SENDER",
        payload.reason
      );

      io.to(payload.sessionId).emit("consent-revoked", {
        sessionId: payload.sessionId,
        reason: payload.reason,
        session: updated
      });
    });

    // ================= Session Clean Shutdown =================
    socket.on("session-terminate", (payload: SessionTerminationPayload) => {
      if (!payload.sessionId) return;
      sessionStore.terminateSession(payload.sessionId, payload.terminatedBy, payload.reason);
      io.to(payload.sessionId).emit("session-terminated", payload);
    });

    // ================= Disconnect with Reconnection Window =================
    socket.on("disconnect", () => {
      if (currentSessionId && currentUserId) {
        const peers = roomPeers.get(currentSessionId);
        if (peers) {
          peers.delete(socket.id);
        }

        // Notify room that peer temporarily disconnected
        socket.to(currentSessionId).emit("peer-disconnected", {
          sessionId: currentSessionId,
          userId: currentUserId,
          role: currentUserRole,
          timestamp: new Date().toISOString()
        });

        // Set a 30s reconnection grace window before marking permanently departed
        const userId = currentUserId;
        const sessionId = currentSessionId;
        const timer = setTimeout(() => {
          reconnectGraceMap.delete(userId);
          io.to(sessionId).emit("peer-abandoned", {
            sessionId,
            userId,
            timestamp: new Date().toISOString()
          });
        }, 30000);

        reconnectGraceMap.set(currentUserId, timer);
      }
    });
  });
}
