import { describe, it, expect } from "vitest";
import { AssistSession, ConsentScope } from "@remoteassist/shared-types";

describe("Shared Types & Security Contracts", () => {
  it("enforces valid session structure with consent records", () => {
    const mockSession: AssistSession = {
      id: "sess_12345",
      sessionCode: "RAW-100-200",
      status: "AWAITING_CONSENT",
      title: "Cross-Border Support Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      initiator: {
        id: "usr_1",
        name: "Dr. Vance",
        region: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" },
        role: "RECEIVER_SPECIALIST"
      },
      consent: {
        senderConsent: {
          id: "cst_1",
          sessionId: "sess_12345",
          userId: "usr_2",
          role: "SENDER",
          status: "NONE",
          scope: {
            allowCamera: false,
            allowMicrophone: false,
            allowVisualAssistance: false,
            acknowledgeSecurityPolicy: false
          }
        },
        receiverConsent: {
          id: "cst_2",
          sessionId: "sess_12345",
          userId: "usr_1",
          role: "RECEIVER_SPECIALIST",
          status: "NONE",
          scope: {
            allowCamera: false,
            allowMicrophone: false,
            allowVisualAssistance: false,
            acknowledgeSecurityPolicy: false
          }
        },
        isFullyConsented: false
      }
    };

    expect(mockSession.status).toBe("AWAITING_CONSENT");
    expect(mockSession.consent.isFullyConsented).toBe(false);
    expect(mockSession.consent.senderConsent.scope.allowCamera).toBe(false);
  });

  it("verifies security scope defaults prevent remote control", () => {
    const scope: ConsentScope = {
      allowCamera: true,
      allowMicrophone: true,
      allowVisualAssistance: true,
      acknowledgeSecurityPolicy: true
    };

    // By architecture, there is no remote control property
    expect((scope as unknown as Record<string, unknown>).allowRemoteControl).toBeUndefined();
    expect(scope.acknowledgeSecurityPolicy).toBe(true);
  });
});
