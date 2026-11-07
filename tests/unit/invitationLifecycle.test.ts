import { describe, it, expect, beforeEach } from "vitest";
import { DbStore } from "@remoteassist/signaling-server/services/dbStore";

describe("Support Invitation Lifecycle & Single-Use Enforcement", () => {
  let store: DbStore;

  beforeEach(() => {
    store = new DbStore();
  });

  it("creates a single-use invitation with cryptographic token and expiration", () => {
    const helper = store.getUserByEmail("helper@remoteassist.local")!;
    const invitation = store.createInvitation({
      helperId: helper.id,
      helperName: helper.name,
      applicantEmail: "candidate@india.example.com",
      targetCountry: "CA",
      expiresInMinutes: 30
    });

    expect(invitation.id).toBeDefined();
    expect(invitation.token).toMatch(/^tok_/);
    expect(invitation.code).toMatch(/^RAW-INV-\d{3}-\d{3}$/);
    expect(invitation.isUsed).toBe(false);
    expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Valid lookup
    const found = store.getInvitationByToken(invitation.token);
    expect(found?.id).toBe(invitation.id);
  });

  it("enforces single-use: consuming an invitation marks it used and rejects subsequent uses", () => {
    const helper = store.getUserByEmail("helper@remoteassist.local")!;
    const invitation = store.createInvitation({
      helperId: helper.id,
      applicantEmail: "singleuse@example.com",
      expiresInMinutes: 30
    });

    // 1st consumption -> Success
    const consumedFirst = store.useInvitation(invitation.token);
    expect(consumedFirst).toBeDefined();
    expect(consumedFirst?.isUsed).toBe(true);
    expect(consumedFirst?.usedAt).toBeDefined();

    // 2nd consumption attempt -> Must FAIL (single-use limit)
    const consumedSecond = store.useInvitation(invitation.token);
    expect(consumedSecond).toBeUndefined();
  });

  it("rejects expired invitations", () => {
    const helper = store.getUserByEmail("helper@remoteassist.local")!;
    // Create an invitation with negative TTL (already expired)
    const expiredInvitation = store.createInvitation({
      helperId: helper.id,
      applicantEmail: "expired@example.com",
      expiresInMinutes: -10
    });

    const result = store.useInvitation(expiredInvitation.token);
    expect(result).toBeUndefined(); // Cannot be used
  });
});
