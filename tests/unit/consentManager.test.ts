import { describe, it, expect } from "vitest";
import { sessionStore } from "@remoteassist/signaling-server/services/sessionStore";
import { ConsentManager } from "@remoteassist/signaling-server/services/consentManager";

describe("ConsentManager Guardrail Enforcement", () => {
  it("blocks video streaming until both parties grant explicit mutual consent", () => {
    const session = sessionStore.createSession({
      initiatorName: "Dr. Vance",
      initiatorRole: "RECEIVER_SPECIALIST",
      initiatorRegion: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" }
    });

    // 1. Initially, streaming is forbidden
    expect(ConsentManager.isStreamingAllowed(session.id)).toBe(false);

    // 2. Receiver grants consent
    sessionStore.updateConsent({
      sessionId: session.id,
      userId: session.initiator.id,
      role: "RECEIVER_SPECIALIST",
      status: "GRANTED",
      scope: {
        allowCamera: true,
        allowMicrophone: false,
        allowVisualAssistance: true,
        acknowledgeSecurityPolicy: true
      }
    });

    // Still forbidden because sender has not consented yet
    expect(ConsentManager.isStreamingAllowed(session.id)).toBe(false);

    // 3. Sender grants consent
    sessionStore.updateConsent({
      sessionId: session.id,
      userId: "usr_sender_in",
      role: "SENDER",
      status: "GRANTED",
      scope: {
        allowCamera: true,
        allowMicrophone: false,
        allowVisualAssistance: true,
        acknowledgeSecurityPolicy: true
      }
    });

    // Now mutual consent is satisfied
    expect(ConsentManager.isStreamingAllowed(session.id)).toBe(true);

    // 4. Emergency revocation by sender
    ConsentManager.revokeConsent(session.id, "usr_sender_in", "SENDER", "User stopped assistance");
    expect(ConsentManager.isStreamingAllowed(session.id)).toBe(false);
  });
});
