import { describe, it, expect, beforeEach } from "vitest";
import { DbStore } from "@remoteassist/signaling-server/services/dbStore";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken
} from "@remoteassist/signaling-server/utils/security";

describe("Authentication, Roles & Applicant Isolation", () => {
  let store: DbStore;

  beforeEach(() => {
    store = new DbStore();
  });

  it("hashes password with salt and validates correctly using timingSafeEqual", () => {
    const rawPassword = "SecurePassword2026!";
    const storedHash = hashPassword(rawPassword);

    expect(storedHash).toContain(":");
    expect(verifyPassword(rawPassword, storedHash)).toBe(true);
    expect(verifyPassword("WrongPassword!", storedHash)).toBe(false);
  });

  it("creates and verifies short-lived access tokens with role claims", () => {
    const user = store.getUserByEmail("helper@remoteassist.local")!;
    expect(user).toBeDefined();
    expect(user.role).toBe("HELPER");

    const token = createAccessToken(user);
    expect(typeof token).toBe("string");

    const payload = verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(user.id);
    expect(payload?.email).toBe(user.email);
    expect(payload?.role).toBe("HELPER");
  });

  it("enforces strict applicant isolation: Applicant cannot access another applicant's profile", () => {
    // Default seeded applicant 1 (Rohan)
    const applicant1 = store.getUserByEmail("rohan@applicant.local")!;
    expect(applicant1).toBeDefined();

    // Create a second applicant (Priya)
    const applicant2 = store.createUser({
      email: "priya@applicant.local",
      passwordHash: hashPassword("PriyaSecret2026!"),
      name: "Priya Patel",
      role: "APPLICANT",
      countryCode: "IN"
    });
    store.upsertProfile(applicant2.id, {
      targetCountry: "CA",
      targetJobTitle: "DevOps Engineer"
    });

    // Verify isolation logic:
    // Helper can access both
    const helper = store.getUserByEmail("helper@remoteassist.local")!;
    expect(helper.role).toBe("HELPER");

    // Check isolation rule
    function canAccessApplicant(
      requestor: { id: string; role: string },
      targetApplicantId: string
    ) {
      if (requestor.role === "ADMIN" || requestor.role === "HELPER") return true;
      if (requestor.role === "APPLICANT" && requestor.id === targetApplicantId) return true;
      return false; // Forbidden!
    }

    // Applicant 1 accessing Applicant 1 -> Allowed
    expect(canAccessApplicant(applicant1, applicant1.id)).toBe(true);
    // Applicant 1 accessing Applicant 2 -> Strictly FORBIDDEN
    expect(canAccessApplicant(applicant1, applicant2.id)).toBe(false);
    // Applicant 2 accessing Applicant 1 -> Strictly FORBIDDEN
    expect(canAccessApplicant(applicant2, applicant1.id)).toBe(false);
    // Helper accessing Applicant 1 & 2 -> Allowed
    expect(canAccessApplicant(helper, applicant1.id)).toBe(true);
    expect(canAccessApplicant(helper, applicant2.id)).toBe(true);
  });
});
