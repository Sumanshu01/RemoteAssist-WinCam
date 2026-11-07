import { UserRole } from "@remoteassist/shared-types";
import { sessionStore } from "./sessionStore";

export class ConsentManager {
  /**
   * Validate whether media stream or visual assist can proceed.
   * RemoteAssist WinCam strictly requires mutual consent.
   */
  static isStreamingAllowed(sessionId: string): boolean {
    const session = sessionStore.getSessionById(sessionId);
    if (!session) return false;

    if (session.status !== "ACTIVE" && session.status !== "AWAITING_CONSENT") {
      return false;
    }

    const { senderConsent, receiverConsent, isFullyConsented } = session.consent;

    // Guardrail: Both parties must have acknowledged security policies and granted active consent
    const senderActive =
      senderConsent.status === "GRANTED" &&
      senderConsent.scope.allowCamera &&
      senderConsent.scope.acknowledgeSecurityPolicy;

    const receiverActive =
      receiverConsent.status === "GRANTED" && receiverConsent.scope.acknowledgeSecurityPolicy;

    return isFullyConsented && senderActive && receiverActive;
  }

  /**
   * Check if visual assistance annotations are consented
   */
  static isVisualAssistanceAllowed(sessionId: string): boolean {
    const session = sessionStore.getSessionById(sessionId);
    if (!session) return false;
    return (
      session.consent.isFullyConsented &&
      session.consent.senderConsent.scope.allowVisualAssistance &&
      session.consent.receiverConsent.scope.allowVisualAssistance
    );
  }

  /**
   * Immediately revoke consent and invalidate session media stream
   */
  static revokeConsent(sessionId: string, userId: string, role: UserRole, reason: string) {
    const session = sessionStore.updateConsent({
      sessionId,
      userId,
      role,
      status: "REVOKED",
      scope: {
        allowCamera: false,
        allowMicrophone: false,
        allowVisualAssistance: false,
        acknowledgeSecurityPolicy: false
      }
    });

    if (session) {
      sessionStore.terminateSession(sessionId, userId, `Consent Revoked by ${role}: ${reason}`);
    }

    return session;
  }
}
