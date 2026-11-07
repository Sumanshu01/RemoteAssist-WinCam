import { describe, it, expect } from "vitest";
import { SessionStore } from "@remoteassist/signaling-server/services/sessionStore";

describe("SessionStore Service", () => {
  it("creates a new session with formatted invitation code and audit record", () => {
    const store = new SessionStore();
    const session = store.createSession({
      initiatorName: "Dr. Aris Vance",
      initiatorRole: "RECEIVER_SPECIALIST",
      initiatorRegion: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" },
      targetRegion: { countryCode: "IN", countryName: "India", timezone: "Asia/Kolkata" }
    });

    expect(session.id).toBeDefined();
    expect(session.sessionCode).toMatch(/^RAW-\d{3}-\d{3}$/);
    expect(session.status).toBe("AWAITING_CONSENT");
    expect(session.consent.isFullyConsented).toBe(false);

    // Verify lookup by code
    const lookedUp = store.getSessionByCode(session.sessionCode);
    expect(lookedUp?.id).toBe(session.id);

    // Verify audit logs
    const auditLogs = store.getAuditLogs(session.id);
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].eventType).toBe("SESSION_CREATED");
  });

  it("handles peer joining and updates session participant", () => {
    const store = new SessionStore();
    const session = store.createSession({
      initiatorName: "Dr. Aris Vance",
      initiatorRole: "RECEIVER_SPECIALIST",
      initiatorRegion: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" }
    });

    const updated = store.joinSession({
      sessionId: session.id,
      participantName: "Rohan Sharma",
      role: "SENDER",
      region: { countryCode: "IN", countryName: "India", timezone: "Asia/Kolkata" }
    });

    expect(updated?.participant?.name).toBe("Rohan Sharma");
    expect(updated?.participant?.role).toBe("SENDER");
    expect(updated?.participant?.region.countryCode).toBe("IN");
  });
});
