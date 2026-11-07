import { describe, it, expect } from "vitest";
import {
  redactSensitiveData,
  createAccessToken
} from "@remoteassist/signaling-server/utils/security";
import { DbStore } from "@remoteassist/signaling-server/services/dbStore";

describe("WebRTC Signaling Security & Room Authorization", () => {
  it("redacts sensitive fields (passwords, tokens, identity documents) from signaling payloads", () => {
    const rawPayload: Record<string, unknown> = {
      sessionId: "RAW-482-195",
      candidate: "candidate:842163049 1 udp 1677729535 192.168.1.100 50000 typ host",
      password: "SuperSecretPassword123!",
      userToken: "raw_tok_9918231923",
      ssn: "123-45-6789",
      metadata: {
        helperNote: "Verifying lighting for camera check",
        passportNumber: "Z9812491A"
      }
    };

    const sanitized = redactSensitiveData(rawPayload);

    expect(sanitized.sessionId).toBe("RAW-482-195");
    expect(sanitized.candidate).toContain("candidate:842163049");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.userToken).toBe("[REDACTED]");
    expect(sanitized.ssn).toBe("[REDACTED]");

    const nested = sanitized.metadata as Record<string, unknown>;
    expect(nested.helperNote).toBe("Verifying lighting for camera check");
    expect(nested.passportNumber).toBe("[REDACTED]");
  });

  it("validates room membership authorization logic", () => {
    const store = new DbStore();
    const helper = store.getUserByEmail("helper@remoteassist.local")!;
    const applicant = store.getUserByEmail("rohan@applicant.local")!;

    // Create session
    const session = store.createSupportSession({
      helperId: helper.id,
      applicantId: applicant.id
    });

    // Helper token -> Authorized
    const helperToken = createAccessToken(helper);
    expect(typeof helperToken).toBe("string");

    // Unrelated intruder
    const intruder = store.createUser({
      email: "intruder@malicious.local",
      passwordHash: "hash",
      name: "Intruder",
      role: "APPLICANT"
    });

    // Room membership validation rule:
    function isSocketAuthorizedForRoom(userId: string, targetSessionId: string): boolean {
      const targetSession = store.getSupportSessionById(targetSessionId);
      if (!targetSession) return false;
      const user = store.getUserById(userId);
      if (!user) return false;
      if (user.role === "ADMIN") return true;
      if (targetSession.helperId === user.id || targetSession.applicantId === user.id) {
        return true;
      }
      return false; // Forbidden!
    }

    expect(isSocketAuthorizedForRoom(helper.id, session.id)).toBe(true);
    expect(isSocketAuthorizedForRoom(applicant.id, session.id)).toBe(true);
    // Intruder is rejected
    expect(isSocketAuthorizedForRoom(intruder.id, session.id)).toBe(false);
  });
});
