import {
  AssistSession,
  ConsentRecord,
  ConsentScope,
  ConsentStatus,
  RegionInfo,
  UserRole,
  AuditLogEntry
} from "@remoteassist/shared-types";
import { config } from "../config";

export class SessionStore {
  private sessions: Map<string, AssistSession> = new Map();
  private sessionCodeMap: Map<string, string> = new Map(); // sessionCode -> id
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.seedDefaultSession();
  }

  public seedDefaultSession(): AssistSession {
    const id = "sess_default_corridor";
    const sessionCode = "RAW-482-195";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours for dev / demo

    const initiatorConsent: ConsentRecord = {
      id: "cst_init_default",
      sessionId: id,
      userId: "usr_helper_aris",
      role: "RECEIVER_SPECIALIST",
      status: "NONE",
      scope: {
        allowCamera: true,
        allowMicrophone: false,
        allowVisualAssistance: true,
        acknowledgeSecurityPolicy: true
      }
    };

    const receiverConsent: ConsentRecord = {
      id: "cst_recv_default",
      sessionId: id,
      userId: "usr_applicant_in",
      role: "SENDER",
      status: "NONE",
      scope: {
        allowCamera: true,
        allowMicrophone: false,
        allowVisualAssistance: true,
        acknowledgeSecurityPolicy: true
      }
    };

    const session: AssistSession = {
      id,
      sessionCode,
      status: "AWAITING_CONSENT",
      title: "Cross-Border Remote Video Assist (Canada - India)",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      initiator: {
        id: initiatorConsent.userId,
        name: "Dr. Aris Vance",
        region: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" },
        role: "RECEIVER_SPECIALIST"
      },
      consent: {
        senderConsent: receiverConsent,
        receiverConsent: initiatorConsent,
        isFullyConsented: false
      }
    };

    this.sessions.set(id, session);
    this.sessionCodeMap.set(sessionCode, id);
    return session;
  }

  createSession(params: {
    title?: string;
    initiatorName: string;
    initiatorRole: UserRole;
    initiatorRegion: RegionInfo;
    targetRegion?: RegionInfo;
  }): AssistSession {
    const id = "sess_" + Math.random().toString(36).substring(2, 10);
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionCode = `RAW-${randomDigits.slice(0, 3)}-${randomDigits.slice(3, 6)}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.sessionExpiryMinutes * 60 * 1000);

    const initiatorConsent: ConsentRecord = {
      id: "cst_" + Math.random().toString(36).substring(2, 10),
      sessionId: id,
      userId: "usr_" + Math.random().toString(36).substring(2, 10),
      role: params.initiatorRole,
      status: "NONE",
      scope: {
        allowCamera: false,
        allowMicrophone: false,
        allowVisualAssistance: false,
        acknowledgeSecurityPolicy: false
      }
    };

    const receiverConsent: ConsentRecord = {
      id: "cst_" + Math.random().toString(36).substring(2, 10),
      sessionId: id,
      userId: "",
      role: params.initiatorRole === "SENDER" ? "RECEIVER_SPECIALIST" : "SENDER",
      status: "NONE",
      scope: {
        allowCamera: false,
        allowMicrophone: false,
        allowVisualAssistance: false,
        acknowledgeSecurityPolicy: false
      }
    };

    const session: AssistSession = {
      id,
      sessionCode,
      status: "AWAITING_CONSENT",
      title: params.title || "Cross-Border Remote Video Assist",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      initiator: {
        id: initiatorConsent.userId,
        name: params.initiatorName,
        region: params.initiatorRegion,
        role: params.initiatorRole
      },
      consent: {
        senderConsent: params.initiatorRole === "SENDER" ? initiatorConsent : receiverConsent,
        receiverConsent:
          params.initiatorRole === "RECEIVER_SPECIALIST" ? initiatorConsent : receiverConsent,
        isFullyConsented: false
      }
    };

    this.sessions.set(id, session);
    this.sessionCodeMap.set(sessionCode, id);

    this.logAudit({
      sessionId: id,
      eventType: "SESSION_CREATED",
      actorRole: params.initiatorRole,
      actorId: initiatorConsent.userId,
      details: {
        sessionCode,
        initiatorRegion: params.initiatorRegion,
        targetRegion: params.targetRegion
      }
    });

    return session;
  }

  /** Re-maps a session to a specific invitation code (used for dev auto-provisioning). */
  registerSessionCode(code: string, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessionCodeMap.delete(session.sessionCode);
    session.sessionCode = code.trim().toUpperCase();
    this.sessionCodeMap.set(session.sessionCode, sessionId);
  }

  getSessionById(id: string): AssistSession | undefined {
    return this.sessions.get(id);
  }

  getSessionByCode(code: string): AssistSession | undefined {
    const id = this.sessionCodeMap.get(code.trim().toUpperCase());
    return id ? this.sessions.get(id) : undefined;
  }

  joinSession(params: {
    sessionId: string;
    participantName: string;
    role: UserRole;
    region: RegionInfo;
  }): AssistSession | undefined {
    const session = this.sessions.get(params.sessionId);
    if (!session) return undefined;

    const participantId = "usr_" + Math.random().toString(36).substring(2, 10);
    session.participant = {
      id: participantId,
      name: params.participantName,
      region: params.region,
      role: params.role
    };

    if (params.role === "SENDER") {
      session.consent.senderConsent.userId = participantId;
    } else {
      session.consent.receiverConsent.userId = participantId;
    }

    session.updatedAt = new Date().toISOString();

    this.logAudit({
      sessionId: session.id,
      eventType: "PEER_JOINED",
      actorRole: params.role,
      actorId: participantId,
      details: { participantName: params.participantName, region: params.region }
    });

    return session;
  }

  updateConsent(params: {
    sessionId: string;
    userId: string;
    role: UserRole;
    status: ConsentStatus;
    scope: ConsentScope;
  }): AssistSession | undefined {
    const session = this.sessions.get(params.sessionId);
    if (!session) return undefined;

    const targetConsent =
      params.role === "SENDER" ? session.consent.senderConsent : session.consent.receiverConsent;

    targetConsent.status = params.status;
    targetConsent.scope = params.scope;
    targetConsent.userId = params.userId;

    if (params.status === "GRANTED") {
      targetConsent.grantedAt = new Date().toISOString();
    } else if (params.status === "REVOKED") {
      targetConsent.revokedAt = new Date().toISOString();
    }

    // Mutual consent check
    const senderOk = session.consent.senderConsent.status === "GRANTED";
    const receiverOk = session.consent.receiverConsent.status === "GRANTED";
    session.consent.isFullyConsented = senderOk && receiverOk;

    if (session.consent.isFullyConsented) {
      session.status = "ACTIVE";
    } else if (params.status === "REVOKED") {
      session.status = "TERMINATED";
    }

    session.updatedAt = new Date().toISOString();

    this.logAudit({
      sessionId: session.id,
      eventType: params.status === "GRANTED" ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
      actorRole: params.role,
      actorId: params.userId,
      details: { scope: params.scope, isFullyConsented: session.consent.isFullyConsented }
    });

    return session;
  }

  terminateSession(
    sessionId: string,
    terminatedBy: string,
    reason: string
  ): AssistSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.status = "TERMINATED";
    session.updatedAt = new Date().toISOString();

    this.logAudit({
      sessionId,
      eventType: "SESSION_TERMINATED",
      actorRole: "SUPERVISOR",
      actorId: terminatedBy,
      details: { reason }
    });

    return session;
  }

  logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): void {
    if (!config.auditLogEnabled) return;
    this.auditLogs.push({
      ...entry,
      id: "aud_" + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toISOString()
    });
  }

  getAuditLogs(sessionId?: string): AuditLogEntry[] {
    if (sessionId) {
      return this.auditLogs.filter((log) => log.sessionId === sessionId);
    }
    return this.auditLogs;
  }

  resetForTesting(): void {
    this.sessions.clear();
    this.sessionCodeMap.clear();
    this.auditLogs = [];
  }
}

export const sessionStore = new SessionStore();
